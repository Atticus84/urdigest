import { inngest } from './client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { summarizePosts, generateFallbackSummaries } from '@/lib/ai/summarize'
import { sendDigestEmail, sendTrialEndedEmail } from '@/lib/email/send'
import { format } from 'date-fns'

/**
 * Convert a user's digest_time + timezone into UTC hour.
 * Returns the UTC hour (0-23) when the digest should be sent.
 */
function getDigestUtcHour(digestTime: string, timezone: string): number {
  // digestTime is "HH:MM:SS" format
  const localHour = parseInt(digestTime.split(':')[0], 10)

  // Create a date in the user's timezone to find the UTC offset
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  })
  const localNowHour = parseInt(formatter.format(now), 10)
  const utcNowHour = now.getUTCHours()

  // offset = localHour - utcHour (in the user's timezone)
  let offsetHours = localNowHour - utcNowHour
  // Normalize to -12..+12 range
  if (offsetHours > 12) offsetHours -= 24
  if (offsetHours < -12) offsetHours += 24

  // Convert desired local hour to UTC
  let utcHour = localHour - offsetHours
  if (utcHour < 0) utcHour += 24
  if (utcHour >= 24) utcHour -= 24

  return utcHour
}

export const dailyDigest = inngest.createFunction(
  { id: 'daily-digest', name: 'Generate and send daily digests' },
  { cron: '0 * * * *' }, // Run every hour, filter by user timezone
  async ({ event, step }) => {
    const currentUtcHour = new Date().getUTCHours()

    // Get all users who should receive digests
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('digest_enabled', true)
      .in('subscription_status', ['trial', 'active'])

    if (error || !users) {
      console.error('Failed to fetch users:', error)
      return { error: 'Failed to fetch users' }
    }

    // Filter to users whose digest time matches the current UTC hour
    const eligibleUsers = users.filter((user) => {
      const digestUtcHour = getDigestUtcHour(
        user.digest_time || '06:00:00',
        user.timezone || 'America/New_York'
      )
      return digestUtcHour === currentUtcHour
    })

    console.log(`Processing digests for ${eligibleUsers.length} users (${users.length} total, current UTC hour: ${currentUtcHour})`)

    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
    }

    // Process each eligible user
    for (const user of eligibleUsers) {
      try {
        await step.run(`digest-for-${user.id}`, async () => {
          return await generateDigestForUser(user)
        })
        results.success++
      } catch (error) {
        console.error(`Failed to generate digest for user ${user.id}:`, error)
        results.failed++
      }
    }

    return results
  }
)

async function generateDigestForUser(user: any) {
  // Get unprocessed posts from the last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: posts, error } = await supabaseAdmin
    .from('saved_posts')
    .select('*')
    .eq('user_id', user.id)
    .eq('processed', false)
    .gte('saved_at', yesterday)
    .order('saved_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch posts: ${error.message}`)
  }

  // Skip if no posts
  if (!posts || posts.length === 0) {
    console.log(`No posts for user ${user.id}, skipping`)
    return { skipped: true }
  }

  // Check trial status
  if (user.subscription_status === 'trial' && user.trial_digest_sent) {
    console.log(`User ${user.id} trial already used, skipping`)
    return { skipped: true }
  }

  // Generate AI summaries
  let summaries
  let tokensUsed = 0
  let aiCost = 0

  try {
    const result = await summarizePosts(posts)
    summaries = result.summaries
    tokensUsed = result.tokensUsed
    aiCost = result.cost
  } catch (error) {
    console.error('AI summarization failed, using fallback:', error)
    summaries = generateFallbackSummaries(posts)
  }

  // Prepare email data
  const emailPosts = posts.map((post, index) => ({
    id: post.id,
    title: summaries[index]?.title || post.caption?.slice(0, 50) || 'Untitled Post',
    summary: summaries[index]?.summary || post.caption || 'No summary available',
    instagram_url: post.instagram_url,
    thumbnail_url: post.thumbnail_url,
    author_username: post.author_username,
  }))

  // Send email
  const resendEmailId = await sendDigestEmail(
    user.email,
    emailPosts,
    format(new Date(), 'MMMM d, yyyy')
  )

  // Save digest record
  await supabaseAdmin.from('digests').insert({
    user_id: user.id,
    subject: `Your daily urdigest: ${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`,
    post_ids: posts.map(p => p.id),
    post_count: posts.length,
    ai_tokens_used: tokensUsed,
    ai_cost_usd: aiCost.toFixed(6),
    resend_email_id: resendEmailId,
  })

  // Mark posts as processed
  await supabaseAdmin
    .from('saved_posts')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
    })
    .in('id', posts.map(p => p.id))

  // Update user stats
  const updates: any = {
    total_digests_sent: user.total_digests_sent + 1,
  }

  // If trial user, mark trial as used and send trial ended email
  if (user.subscription_status === 'trial') {
    updates.trial_digest_sent = true
    await sendTrialEndedEmail(user.email)
  }

  await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', user.id)

  console.log(`Digest sent successfully for user ${user.id}`)

  return {
    success: true,
    postsCount: posts.length,
    tokensUsed,
    cost: aiCost,
  }
}

// Manual trigger for testing
export const manualDigest = inngest.createFunction(
  { id: 'manual-digest', name: 'Manually trigger digest for a user' },
  { event: 'digest/manual' },
  async ({ event }) => {
    const { userId } = event.data

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (!user) {
      throw new Error('User not found')
    }

    return await generateDigestForUser(user)
  }
)
