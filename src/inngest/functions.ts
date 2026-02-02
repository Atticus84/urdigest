import { inngest } from './client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateNewsletter, generateFallbackNewsletter } from '@/lib/ai/summarize'
import { sendDigestEmail, sendTrialEndedEmail } from '@/lib/email/send'
import { format } from 'date-fns'

export const dailyDigest = inngest.createFunction(
  { id: 'daily-digest', name: 'Generate and send daily digests' },
  { cron: '0 6 * * *' }, // Run at 6am daily
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

    console.log(`Processing digests for ${users.length} users`)

    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
    }

    // Process each user
    for (const user of users) {
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

  // Generate AI newsletter
  let newsletter
  let tokensUsed = 0
  let aiCost = 0

  try {
    const result = await generateNewsletter(posts)
    newsletter = result.newsletter
    tokensUsed = result.tokensUsed
    aiCost = result.cost
  } catch (error) {
    console.error('AI newsletter generation failed, using fallback:', error)
    newsletter = generateFallbackNewsletter(posts)
  }

  const dateStr = format(new Date(), 'MMMM d, yyyy')

  // Get additional recipients
  const { data: recipients } = await supabaseAdmin
    .from('digest_recipients')
    .select('email')
    .eq('user_id', user.id)
    .eq('confirmed', true)

  // Build list of all email addresses (user + recipients)
  const allEmails = [user.email]
  if (recipients && recipients.length > 0) {
    for (const r of recipients) {
      if (!allEmails.includes(r.email)) {
        allEmails.push(r.email)
      }
    }
  }

  // Send email to all recipients
  let resendEmailId = ''
  for (const email of allEmails) {
    const id = await sendDigestEmail(email, newsletter, dateStr, posts.length)
    if (!resendEmailId) resendEmailId = id
  }

  // Save digest record
  await supabaseAdmin.from('digests').insert({
    user_id: user.id,
    subject: newsletter.subject_line,
    summary: newsletter.big_picture || null,
    post_ids: posts.map(p => p.id),
    post_count: posts.length,
    ai_tokens_used: tokensUsed,
    ai_cost_usd: aiCost.toString(),
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
