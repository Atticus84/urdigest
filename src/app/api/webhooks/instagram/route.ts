import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendInstagramMessage } from '@/lib/instagram/send-message'
import { getInstagramUsername } from '@/lib/instagram/get-username'

export const dynamic = 'force-dynamic'

// Verify webhook signature (Meta requirement)
function verifySignature(signature: string, body: string): boolean {
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  if (!appSecret) {
    console.error('INSTAGRAM_APP_SECRET not configured')
    return false
  }

  const expectedSignature = 'sha1=' + crypto
    .createHmac('sha1', appSecret)
    .update(body)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

// Instagram webhook verification (GET request)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
  if (!VERIFY_TOKEN) {
    console.error('INSTAGRAM_WEBHOOK_VERIFY_TOKEN environment variable is not set')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Instagram webhook verified')
    return new NextResponse(challenge, { status: 200 })
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

// Track processed message IDs to prevent duplicate processing
const processedMessageIds = new Set<string>()
const MAX_PROCESSED_IDS = 1000 // Keep last 1000 message IDs in memory

// Instagram webhook events (POST request)
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-hub-signature')
    const body = await request.text()

    console.log('📥 Instagram webhook POST received', {
      signature: signature ? 'present' : 'missing',
      bodyLength: body.length,
      timestamp: new Date().toISOString(),
    })

    if (signature && !verifySignature(signature, body)) {
      console.error('Instagram webhook signature mismatch')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const payload = JSON.parse(body)
    console.log('Instagram webhook payload:', JSON.stringify(payload, null, 2))

    // Handle both 'instagram' and 'page' object types
    if (payload.object === 'instagram' || payload.object === 'page') {
      const eventTypes: string[] = []
      
      for (const entry of payload.entry || []) {
        // Handle messaging array format (standard webhook structure)
        if (entry.messaging) {
          for (const messagingEvent of entry.messaging) {
            // Log all event types we receive
            const eventType = Object.keys(messagingEvent).find(key => 
              key !== 'timestamp' && key !== 'sender' && key !== 'recipient'
            ) || 'unknown'
            eventTypes.push(eventType)
            
            console.log(`Processing messaging event (type: ${eventType}):`, JSON.stringify(messagingEvent, null, 2))
            
            // Skip echo messages (messages sent BY the page/bot itself)
            if (messagingEvent.message?.is_echo) {
              console.log(`Skipping echo message (sent by bot):`, {
                messageId: messagingEvent.message?.mid,
                senderId: messagingEvent.sender?.id,
              })
              continue
            }

            // Skip non-message events (message_edit, message_reactions, etc.)
            if (!messagingEvent.sender || !messagingEvent.message) {
              console.log(`Skipping non-message event (type: ${eventType}):`, {
                hasSender: !!messagingEvent.sender,
                hasMessage: !!messagingEvent.message,
                eventKeys: Object.keys(messagingEvent),
                timestamp: messagingEvent.timestamp,
              })
              continue
            }
            await handleMessage(messagingEvent)
          }
        }
        // Handle changes array format (alternative webhook structure)
        if (entry.changes) {
          for (const change of entry.changes) {
            console.log('Processing webhook change:', JSON.stringify(change, null, 2))
            if (change.field === 'messages' && change.value) {
              const v = change.value
              if (v.message?.is_echo) {
                console.log('Skipping echo message in changes format')
                continue
              }
              if (v.sender && v.message) {
                await handleMessage({ sender: v.sender, message: v.message })
              } else {
                console.log('Change value missing sender or message:', JSON.stringify(v, null, 2))
              }
            }
          }
        }
      }
      
      // Log summary of event types received
      if (eventTypes.length > 0) {
        const eventTypeCounts = eventTypes.reduce((acc, type) => {
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        console.log('📊 Event types received in this webhook call:', eventTypeCounts)
        console.log('⚠️  If you only see "message_edit" events and no "message" events, your webhook may not be subscribed to "messages" events in Meta App Dashboard')
        
        // Log if we're receiving many non-message events (which shouldn't trigger API calls)
        const nonMessageEvents = Object.entries(eventTypeCounts)
          .filter(([type]) => type !== 'message')
          .reduce((sum, [, count]) => sum + count, 0)
        if (nonMessageEvents > 0) {
          console.log(`ℹ️  Received ${nonMessageEvents} non-message event(s) that were skipped (won't consume API quota)`)
        }
      }
    } else {
      console.warn('Unknown webhook object type:', payload.object)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Instagram webhook error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleMessage(event: any) {
  console.log('=== handleMessage START ===')
  
  const senderId = event?.sender?.id
  const senderUsername = event?.sender?.username // Instagram username if available in webhook
  const message = event?.message
  const messageId = message?.mid

  if (!senderId) {
    console.error('❌ No sender.id in event')
    console.log('=== handleMessage END (no sender) ===')
    return
  }

  // Log if username is available in webhook
  if (senderUsername) {
    console.log(`📝 Username found in webhook: ${senderUsername}`)
  } else {
    console.log('ℹ️  Username not in webhook payload, will try to fetch from API if needed')
  }

  if (!message) {
    console.log('❌ No message in event, skipping')
    console.log('=== handleMessage END (no message) ===')
    return
  }

  // Deduplication: Skip if we've already processed this message
  if (messageId && processedMessageIds.has(messageId)) {
    console.log(`⏭️  Skipping duplicate message: ${messageId} from sender ${senderId}`)
    console.log('=== handleMessage END (duplicate) ===')
    return
  }

  // Track this message ID
  if (messageId) {
    processedMessageIds.add(messageId)
    // Clean up old IDs to prevent memory leak
    if (processedMessageIds.size > MAX_PROCESSED_IDS) {
      const firstId = processedMessageIds.values().next().value
      if (firstId) {
        processedMessageIds.delete(firstId)
      }
    }
  }

  console.log(`✅ Processing message from sender ${senderId}:`, {
    text: message.text,
    attachments: message.attachments?.length || 0,
    messageId: messageId,
    timestamp: new Date().toISOString(),
  })

  // Look up user by instagram_user_id
  console.log(`🔍 Looking up user with instagram_user_id: ${senderId}`)
  const { data: user, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('instagram_user_id', senderId)
    .single()

  if (lookupError && lookupError.code !== 'PGRST116') {
    console.error('❌ Error looking up user:', lookupError)
  }

  if (!user) {
    console.log(`👤 User not found, creating new user for Instagram ID: ${senderId}`)
    // New user — create profile and start onboarding
    await handleNewUser(senderId, senderUsername)
    console.log('=== handleMessage END (new user created) ===')
    return
  }

  // Update username if we have it and it's different
  let usernameToStore = senderUsername
  if (!usernameToStore && !user.instagram_username) {
    // Try to fetch username from API if we don't have it
    console.log(`🔍 Fetching Instagram username from API for user ${senderId}...`)
    usernameToStore = await getInstagramUsername(senderId)
    if (usernameToStore) {
      console.log(`✅ Fetched username from API: ${usernameToStore}`)
    }
  }

  if (usernameToStore && user.instagram_username !== usernameToStore) {
    console.log(`📝 Updating Instagram username: ${user.instagram_username || '(none)'} -> ${usernameToStore}`)
    await supabaseAdmin
      .from('users')
      .update({ instagram_username: usernameToStore })
      .eq('id', user.id)
  }

  console.log(`👤 Found existing user: ${user.id}, onboarding_state: ${user.onboarding_state}`)

  // Route based on onboarding state
  switch (user.onboarding_state) {
    case 'awaiting_email':
      await handleEmailResponse(user.id, senderId, message.text || '')
      break
    case 'awaiting_time':
      await handleTimeResponse(user.id, senderId, message.text || '')
      break
    case 'onboarded':
      await handleOnboardedMessage(user.id, senderId, message)
      break
    default:
      // User exists but no onboarding state — treat as needing onboarding
      console.log(`User ${user.id} has no onboarding state, resetting to awaiting_email`)
      await supabaseAdmin
        .from('users')
        .update({ onboarding_state: 'awaiting_email' })
        .eq('id', user.id)
      const sent = await sendInstagramMessage(
        senderId,
        "Welcome back to urdigest! What's your email address so we can send you your daily digest?"
      )
      if (!sent) console.error(`Failed to send welcome back message to ${senderId}`)
      break
  }
}

async function handleNewUser(instagramUserId: string, instagramUsername?: string) {
  console.log(`=== handleNewUser START for Instagram ID: ${instagramUserId}${instagramUsername ? `, username: ${instagramUsername}` : ''} ===`)
  
  // If username not provided in webhook, try to fetch it from API
  if (!instagramUsername) {
    console.log(`🔍 Username not in webhook, fetching from API for ${instagramUserId}...`)
    instagramUsername = await getInstagramUsername(instagramUserId) || undefined
    if (instagramUsername) {
      console.log(`✅ Fetched username from API: ${instagramUsername}`)
    } else {
      console.log(`⚠️  Could not fetch username from API for ${instagramUserId}`)
    }
  }
  
  const email = `pending_${instagramUserId}@placeholder.urdigest`
  let newUserId: string | null = null
  
  // Check if user profile already exists (might have been partially created)
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id, instagram_user_id, onboarding_state')
    .eq('instagram_user_id', instagramUserId)
    .single()

  if (existingUser) {
    console.log(`✅ User profile already exists with ID: ${existingUser.id}`)
    newUserId = existingUser.id
    
    // Update onboarding state if needed
    if (existingUser.onboarding_state !== 'awaiting_email') {
      await supabaseAdmin
        .from('users')
        .update({ onboarding_state: 'awaiting_email' })
        .eq('id', newUserId)
    }
  } else {
    // Create auth user first (required for foreign key constraint)
    const password = crypto.randomUUID() // Random password, user won't use it
    
    console.log(`Creating auth user with email: ${email}`)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since they're signing up via Instagram
    })

    if (authError || !authUser?.user) {
      // If auth user already exists, try to find it
      if (authError?.message?.includes('already registered')) {
        console.log('Auth user already exists, looking up by email...')
        const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingAuth = existingAuthUsers?.users?.find(u => u.email === email)
        if (existingAuth) {
          newUserId = existingAuth.id
          console.log(`✅ Found existing auth user with ID: ${newUserId}`)
        } else {
          console.error('❌ Failed to create/find auth user for Instagram ID:', instagramUserId, {
            error: authError?.message,
            code: authError?.status,
          })
          console.log('=== handleNewUser END (auth error) ===')
          return
        }
      } else {
        console.error('❌ Failed to create auth user for Instagram ID:', instagramUserId, {
          error: authError?.message,
          code: authError?.status,
        })
        console.log('=== handleNewUser END (auth error) ===')
        return
      }
    } else {
      newUserId = authUser.user.id
      console.log(`✅ Auth user created with ID: ${newUserId}`)
    }
    
    // Check if profile already exists with this ID (from previous partial creation)
    const { data: existingProfileById } = await supabaseAdmin
      .from('users')
      .select('id, instagram_user_id')
      .eq('id', newUserId)
      .single()

    if (existingProfileById) {
      console.log(`✅ User profile already exists with this ID, updating...`)
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          instagram_user_id: instagramUserId,
          onboarding_state: 'awaiting_email',
        })
        .eq('id', newUserId)

      if (updateError) {
        console.error('❌ Failed to update existing user profile:', updateError)
        console.log('=== handleNewUser END (update error) ===')
        return
      }
      console.log(`✅ User profile updated successfully`)
    } else {
      // Create the user profile
      const insertData: any = {
        id: newUserId,
        email: email,
        instagram_user_id: instagramUserId,
        onboarding_state: 'awaiting_email',
      }
      if (instagramUsername) {
        insertData.instagram_username = instagramUsername
      }
      
      const { error, data } = await supabaseAdmin
        .from('users')
        .insert(insertData)
        .select()

      if (error) {
        console.error('❌ Failed to create user profile for Instagram ID:', instagramUserId, {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        })
        console.log('=== handleNewUser END (profile error) ===')
        return
      }

      console.log(`✅ User profile created successfully:`, {
        userId: newUserId,
        instagramUserId,
        email: data?.[0]?.email,
      })
    }
  }

  console.log(`📤 Sending welcome message to ${instagramUserId}...`)
  const messageSent = await sendInstagramMessage(
    instagramUserId,
    "👋 Welcome to urdigest! I'll turn your saved Instagram posts into a daily email digest.\n\nFirst, what's your email address?"
  )
  
  if (!messageSent) {
    console.error(`❌ Failed to send welcome message to ${instagramUserId}`)
  } else {
    console.log(`✅ Welcome message sent successfully to ${instagramUserId}`)
  }
  
  console.log('=== handleNewUser END ===')
}

async function handleEmailResponse(userId: string, instagramUserId: string, text: string) {
  console.log(`Handling email response from user ${userId} (Instagram: ${instagramUserId}): ${text}`)
  
  const email = text.trim().toLowerCase()

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    console.log(`Invalid email format: ${email}`)
    const sent = await sendInstagramMessage(
      instagramUserId,
      "That doesn't look like a valid email address. Please send your email address (e.g., you@example.com)"
    )
    if (!sent) console.error(`Failed to send invalid email message to ${instagramUserId}`)
    return
  }

  // Update email in users table
  const { error } = await supabaseAdmin
    .from('users')
    .update({ email, onboarding_state: 'awaiting_time' })
    .eq('id', userId)

  if (error) {
    console.error('Failed to update email:', error)
    const sent = await sendInstagramMessage(instagramUserId, "Something went wrong. Please try sending your email again.")
    if (!sent) console.error(`Failed to send error message to ${instagramUserId}`)
    return
  }

  // Also update the auth user's email so they can log in
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { email }
  )

  if (authError) {
    console.error('Failed to update auth user email:', authError)
    // Don't fail the whole flow, but log it
  } else {
    console.log(`✅ Updated auth user email to ${email}`)
  }

  console.log(`Email updated successfully, asking for time preference`)
  const sent = await sendInstagramMessage(
    instagramUserId,
    "Got it! What time would you like your daily digest sent? (e.g., 8:00 AM, 7 PM, 18:00)"
  )
  if (!sent) console.error(`Failed to send time request message to ${instagramUserId}`)
}

function parseTime(text: string): string | null {
  const cleaned = text.trim().toLowerCase().replace(/\s+/g, ' ')

  // Match patterns like "8:00 AM", "8am", "7 PM", "18:00", "8:30am"
  const match12h = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (match12h) {
    let hours = parseInt(match12h[1])
    const minutes = parseInt(match12h[2] || '0')
    const period = match12h[3].toLowerCase()

    if (hours < 1 || hours > 12 || minutes > 59) return null

    if (period === 'pm' && hours !== 12) hours += 12
    if (period === 'am' && hours === 12) hours = 0

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
  }

  // Match 24h format like "18:00", "8:00"
  const match24h = cleaned.match(/^(\d{1,2}):(\d{2})$/)
  if (match24h) {
    const hours = parseInt(match24h[1])
    const minutes = parseInt(match24h[2])
    if (hours > 23 || minutes > 59) return null
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
  }

  return null
}

async function handleTimeResponse(userId: string, instagramUserId: string, text: string) {
  console.log(`Handling time response from user ${userId} (Instagram: ${instagramUserId}): ${text}`)
  
  const digestTime = parseTime(text)

  if (!digestTime) {
    console.log(`Could not parse time: ${text}`)
    const sent = await sendInstagramMessage(
      instagramUserId,
      "I couldn't understand that time. Please try again (e.g., 8:00 AM, 7 PM, 18:00)"
    )
    if (!sent) console.error(`Failed to send invalid time message to ${instagramUserId}`)
    return
  }

  console.log(`Parsed time: ${digestTime}`)
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      digest_time: digestTime,
      onboarding_state: 'onboarded',
      digest_enabled: true,
    })
    .eq('id', userId)

  if (error) {
    console.error('Failed to update digest time:', error)
    const sent = await sendInstagramMessage(instagramUserId, "Something went wrong. Please try sending the time again.")
    if (!sent) console.error(`Failed to send error message to ${instagramUserId}`)
    return
  }

  console.log(`User ${userId} onboarded successfully`)
  const sent = await sendInstagramMessage(
    instagramUserId,
    "You're all set! 🎉 Now just send me any Instagram posts and I'll include them in your daily digest.\n\nTo share a post, open it in Instagram and use the share button to send it to me here."
  )
  if (!sent) console.error(`Failed to send onboarding complete message to ${instagramUserId}`)
}

async function handleOnboardedMessage(userId: string, instagramUserId: string, message: any) {
  console.log(`Handling onboarded message from user ${userId}:`, {
    hasText: !!message.text,
    hasAttachments: !!message.attachments,
    attachmentCount: message.attachments?.length || 0,
  })

  // Check for shared media (Instagram post shared via DM)
  if (message.attachments) {
    let savedCount = 0
    for (const attachment of message.attachments) {
      console.log(`Processing attachment:`, { type: attachment.type })
      if (
        attachment.type === 'media_share' ||
        attachment.type === 'share' ||
        attachment.type === 'video' ||
        attachment.type === 'ig_reel' ||
        attachment.type === 'animated_image_share' ||
        attachment.type === 'clip'
      ) {
        const saved = await saveInstagramPost(userId, attachment.payload, attachment.type)
        if (saved) savedCount++
      }
    }

    if (savedCount > 0) {
      console.log(`Saved ${savedCount} post(s) for user ${userId}`)
      const sent = await sendInstagramMessage(
        instagramUserId,
        savedCount === 1
          ? "✅ Added to your next digest!"
          : `✅ Added ${savedCount} posts to your next digest!`
      )
      if (!sent) console.error(`Failed to send confirmation message to ${instagramUserId}`)
      return
    }
  }

  // If it's a text message (not a shared post), provide help
  if (message.text) {
    const text = message.text.trim().toLowerCase()
    console.log(`Processing text command: "${text}"`)

    if (text === 'help') {
      const sent = await sendInstagramMessage(
        instagramUserId,
        "📬 urdigest Help:\n• Share Instagram posts with me to add them to your digest\n• Send \"status\" to check your digest info\n• Send \"pause\" to pause digests\n• Send \"resume\" to resume digests"
      )
      if (!sent) console.error(`Failed to send help message to ${instagramUserId}`)
      return
    }

    if (text === 'status') {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('email, digest_time, digest_enabled, total_posts_saved, total_digests_sent')
        .eq('id', userId)
        .single()

      if (user) {
        const sent = await sendInstagramMessage(
          instagramUserId,
          `📊 Your urdigest status:\n• Email: ${user.email}\n• Digest time: ${user.digest_time}\n• Digests enabled: ${user.digest_enabled ? 'Yes' : 'No'}\n• Posts saved: ${user.total_posts_saved}\n• Digests sent: ${user.total_digests_sent}`
        )
        if (!sent) console.error(`Failed to send status message to ${instagramUserId}`)
      }
      return
    }

    if (text === 'pause') {
      await supabaseAdmin.from('users').update({ digest_enabled: false }).eq('id', userId)
      const sent = await sendInstagramMessage(instagramUserId, "⏸️ Digests paused. Send \"resume\" to start them again.")
      if (!sent) console.error(`Failed to send pause confirmation to ${instagramUserId}`)
      return
    }

    if (text === 'resume') {
      await supabaseAdmin.from('users').update({ digest_enabled: true }).eq('id', userId)
      const sent = await sendInstagramMessage(instagramUserId, "▶️ Digests resumed! You'll get your next digest at your scheduled time.")
      if (!sent) console.error(`Failed to send resume confirmation to ${instagramUserId}`)
      return
    }

    // Default: they sent a text message that isn't a command
    console.log(`Unknown text command: "${text}", sending help message`)
    const sent = await sendInstagramMessage(
      instagramUserId,
      "To add a post to your digest, share it with me using Instagram's share button. Send \"help\" for more options."
    )
    if (!sent) console.error(`Failed to send default help message to ${instagramUserId}`)
  }
}

// Detect post type from URL pattern and attachment type
function detectPostType(url: string, attachmentType?: string): string {
  if (url.includes('/reel/') || url.includes('/reels/')) return 'reel'
  if (attachmentType === 'video' || attachmentType === 'clip' || attachmentType === 'ig_reel') return 'video'
  if (attachmentType === 'animated_image_share') return 'video'
  if (url.includes('/p/')) return 'photo'
  return 'photo'
}

// Fetch metadata from Instagram oEmbed API (no auth required)
async function fetchInstagramMetadata(postUrl: string): Promise<{
  title?: string
  author_name?: string
  thumbnail_url?: string
} | null> {
  try {
    const oEmbedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(postUrl)}&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN || ''}`
    const response = await fetch(oEmbedUrl, { signal: AbortSignal.timeout(5000) })

    if (response.ok) {
      const data = await response.json()
      return {
        title: data.title || undefined,
        author_name: data.author_name || undefined,
        thumbnail_url: data.thumbnail_url || undefined,
      }
    }

    // Fallback: try the public oEmbed endpoint
    const publicUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}`
    const publicResponse = await fetch(publicUrl, { signal: AbortSignal.timeout(5000) })

    if (publicResponse.ok) {
      const data = await publicResponse.json()
      return {
        title: data.title || undefined,
        author_name: data.author_name || undefined,
        thumbnail_url: data.thumbnail_url || undefined,
      }
    }

    console.log(`oEmbed fetch failed for ${postUrl}: ${response.status}`)
    return null
  } catch (error) {
    console.log(`oEmbed fetch error for ${postUrl}:`, error instanceof Error ? error.message : error)
    return null
  }
}

async function saveInstagramPost(userId: string, payload: any, attachmentType?: string): Promise<boolean> {
  try {
    const postUrl = payload?.url || ''
    const postId = postUrl.match(/\/p\/([^\/]+)/)?.[1] || postUrl.match(/\/reel\/([^\/]+)/)?.[1]

    if (!postUrl) {
      console.error('No URL in shared post payload')
      return false
    }

    // Check for duplicate
    if (postId) {
      const { data: existing } = await supabaseAdmin
        .from('saved_posts')
        .select('id')
        .eq('user_id', userId)
        .eq('instagram_post_id', postId)
        .single()

      if (existing) {
        return false // Already saved
      }
    }

    // Detect post type
    const postType = detectPostType(postUrl, attachmentType)
    console.log(`Detected post type: ${postType} for URL: ${postUrl} (attachment: ${attachmentType})`)

    // Attempt to fetch metadata via oEmbed
    const metadata = await fetchInstagramMetadata(postUrl)
    if (metadata) {
      console.log(`Fetched oEmbed metadata for ${postUrl}:`, metadata)
    }

    await supabaseAdmin
      .from('saved_posts')
      .insert({
        user_id: userId,
        instagram_post_id: postId || null,
        instagram_url: postUrl,
        post_type: postType,
        caption: metadata?.title || null,
        author_username: metadata?.author_name || null,
        thumbnail_url: metadata?.thumbnail_url || null,
      })

    // Update post count
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('total_posts_saved')
      .eq('id', userId)
      .single()

    await supabaseAdmin
      .from('users')
      .update({
        total_posts_saved: (currentUser?.total_posts_saved || 0) + 1,
        last_post_received_at: new Date().toISOString(),
      })
      .eq('id', userId)

    console.log(`Saved post for user ${userId}: ${postUrl}`)
    return true
  } catch (error) {
    console.error('Error saving Instagram post:', error)
    return false
  }
}
