import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendInstagramMessage } from '@/lib/instagram/send-message'

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

  const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'urdigest_verify_token'

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Instagram webhook verified')
    return new NextResponse(challenge, { status: 200 })
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

// Instagram webhook events (POST request)
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-hub-signature')
    const body = await request.text()

    if (!signature || !verifySignature(signature, body)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const payload = JSON.parse(body)

    if (payload.object === 'instagram') {
      for (const entry of payload.entry) {
        if (entry.messaging) {
          for (const messagingEvent of entry.messaging) {
            await handleMessage(messagingEvent)
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Instagram webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleMessage(event: any) {
  const senderId = event.sender.id
  const message = event.message

  if (!message) return

  // Look up user by instagram_user_id
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('instagram_user_id', senderId)
    .single()

  if (!user) {
    // New user — create profile and start onboarding
    await handleNewUser(senderId)
    return
  }

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
      await supabaseAdmin
        .from('users')
        .update({ onboarding_state: 'awaiting_email' })
        .eq('id', user.id)
      await sendInstagramMessage(
        senderId,
        "Welcome back to urdigest! What's your email address so we can send you your daily digest?"
      )
      break
  }
}

async function handleNewUser(instagramUserId: string) {
  // Create a new user record with just the instagram_user_id
  const { error } = await supabaseAdmin
    .from('users')
    .insert({
      id: crypto.randomUUID(),
      email: `pending_${instagramUserId}@placeholder.urdigest`,
      instagram_user_id: instagramUserId,
      onboarding_state: 'awaiting_email',
    })

  if (error) {
    console.error('Failed to create user for Instagram ID:', instagramUserId, error)
    return
  }

  await sendInstagramMessage(
    instagramUserId,
    "👋 Welcome to urdigest! I'll turn your saved Instagram posts into a daily email digest.\n\nFirst, what's your email address?"
  )
}

async function handleEmailResponse(userId: string, instagramUserId: string, text: string) {
  const email = text.trim().toLowerCase()

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    await sendInstagramMessage(
      instagramUserId,
      "That doesn't look like a valid email address. Please send your email address (e.g., you@example.com)"
    )
    return
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ email, onboarding_state: 'awaiting_time' })
    .eq('id', userId)

  if (error) {
    console.error('Failed to update email:', error)
    await sendInstagramMessage(instagramUserId, "Something went wrong. Please try sending your email again.")
    return
  }

  await sendInstagramMessage(
    instagramUserId,
    "Got it! What time would you like your daily digest sent? (e.g., 8:00 AM, 7 PM, 18:00)"
  )
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
  const digestTime = parseTime(text)

  if (!digestTime) {
    await sendInstagramMessage(
      instagramUserId,
      "I couldn't understand that time. Please try again (e.g., 8:00 AM, 7 PM, 18:00)"
    )
    return
  }

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
    await sendInstagramMessage(instagramUserId, "Something went wrong. Please try sending the time again.")
    return
  }

  await sendInstagramMessage(
    instagramUserId,
    "You're all set! 🎉 Now just send me any Instagram posts and I'll include them in your daily digest.\n\nTo share a post, open it in Instagram and use the share button to send it to me here."
  )
}

async function handleOnboardedMessage(userId: string, instagramUserId: string, message: any) {
  // Check for shared media (Instagram post shared via DM)
  if (message.attachments) {
    let savedCount = 0
    for (const attachment of message.attachments) {
      if (attachment.type === 'media_share' || attachment.type === 'share') {
        const saved = await saveInstagramPost(userId, attachment.payload)
        if (saved) savedCount++
      }
    }

    if (savedCount > 0) {
      await sendInstagramMessage(
        instagramUserId,
        savedCount === 1
          ? "✅ Added to your next digest!"
          : `✅ Added ${savedCount} posts to your next digest!`
      )
      return
    }
  }

  // If it's a text message (not a shared post), provide help
  if (message.text) {
    const text = message.text.trim().toLowerCase()

    if (text === 'help') {
      await sendInstagramMessage(
        instagramUserId,
        "📬 urdigest Help:\n• Share Instagram posts with me to add them to your digest\n• Send \"status\" to check your digest info\n• Send \"pause\" to pause digests\n• Send \"resume\" to resume digests"
      )
      return
    }

    if (text === 'status') {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('email, digest_time, digest_enabled, total_posts_saved, total_digests_sent')
        .eq('id', userId)
        .single()

      if (user) {
        await sendInstagramMessage(
          instagramUserId,
          `📊 Your urdigest status:\n• Email: ${user.email}\n• Digest time: ${user.digest_time}\n• Digests enabled: ${user.digest_enabled ? 'Yes' : 'No'}\n• Posts saved: ${user.total_posts_saved}\n• Digests sent: ${user.total_digests_sent}`
        )
      }
      return
    }

    if (text === 'pause') {
      await supabaseAdmin.from('users').update({ digest_enabled: false }).eq('id', userId)
      await sendInstagramMessage(instagramUserId, "⏸️ Digests paused. Send \"resume\" to start them again.")
      return
    }

    if (text === 'resume') {
      await supabaseAdmin.from('users').update({ digest_enabled: true }).eq('id', userId)
      await sendInstagramMessage(instagramUserId, "▶️ Digests resumed! You'll get your next digest at your scheduled time.")
      return
    }

    // Default: they sent a text message that isn't a command
    await sendInstagramMessage(
      instagramUserId,
      "To add a post to your digest, share it with me using Instagram's share button. Send \"help\" for more options."
    )
  }
}

async function saveInstagramPost(userId: string, payload: any): Promise<boolean> {
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

    await supabaseAdmin
      .from('saved_posts')
      .insert({
        user_id: userId,
        instagram_post_id: postId || null,
        instagram_url: postUrl,
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
