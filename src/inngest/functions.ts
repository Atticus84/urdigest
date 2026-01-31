import { inngest } from './client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { summarizePosts, generateFallbackSummaries } from '@/lib/ai/summarize'
import { sendDigestEmail, sendTrialEndedEmail } from '@/lib/email/send'
import { generateUnsubscribeToken } from '@/lib/unsubscribe-token'
import { format } from 'date-fns'

// Checks if a user's preferred digest time falls within the current 15-minute window
function isUserDigestTimeNow(digestTime: string, timezone: string): boolean {
  try {
    // Get current time in the user's timezone
    const now = new Date()
    const userTimeStr = now.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    })

    // Parse user's current time and their preferred digest time
    const [nowHour, nowMinute] = userTimeStr.split(':').map(Number)
    const [prefHour, prefMinute] = digestTime.split(':').map(Number)

    const nowTotalMinutes = nowHour * 60 + nowMinute
    const prefTotalMinutes = prefHour * 60 + prefMinute

    // Check if within the current 15-minute window
    return nowTotalMinutes >= prefTotalMinutes && nowTotalMinutes < prefTotalMinutes + 15
  } catch (error) {
    console.error(`Error checking digest time for timezone ${timezone}:`, error)
    return false
  }
}

export const dailyDigest = inngest.createFunction(
  { id: 'daily-digest', name: 'Generate and send daily digests' },
  { cron: '*/15 * * * *' }, // Run every 15 minutes, check per-user timing
  async ({ event, step }) => {
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

    // Filter to users whose digest time is now in their timezone
    const eligibleUsers = users.filter(user =>
      isUserDigestTimeNow(
        user.digest_time || '06:00:00',
        user.timezone || 'America/New_York'
      )
    )

    console.log(`Digest check: ${users.length} total users, ${eligibleUsers.length} eligible right now`)

    if (eligibleUsers.length === 0) {
      return { success: 0, skipped: 0, failed: 0, checked: users.length }
    }

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
  // Get all unprocessed posts for this user
  const { data: posts, error } = await supabaseAdmin
    .from('saved_posts')
    .select('*')
    .eq('user_id', user.id)
    .eq('processed', false)
    .order('saved_at', { ascending: false })
    .limit(30)

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

  // Send email — if this fails, don't mark posts as processed
  const unsubscribeToken = generateUnsubscribeToken(user.email)
  let resendEmailId: string

  try {
    resendEmailId = await sendDigestEmail(
      user.email,
      emailPosts,
      format(new Date(), 'MMMM d, yyyy'),
      unsubscribeToken
    )
  } catch (emailError) {
    console.error(`Email send failed for user ${user.id}, posts NOT marked as processed:`, emailError)
    throw new Error(`Email delivery failed: ${emailError instanceof Error ? emailError.message : String(emailError)}`)
  }

  // Only mark posts processed and save digest after successful email send
  await supabaseAdmin.from('digests').insert({
    user_id: user.id,
    subject: `Your daily urdigest: ${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`,
    post_ids: posts.map(p => p.id),
    post_count: posts.length,
    ai_tokens_used: tokensUsed,
    ai_cost_usd: aiCost.toString(),
    resend_email_id: resendEmailId,
  })

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
