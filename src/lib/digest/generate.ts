import { supabaseAdmin } from '@/lib/supabase/admin'
import { summarizePosts, generateFallbackSummaries } from '@/lib/ai/summarize'
import { sendDigestEmail, sendTrialEndedEmail } from '@/lib/email/send'
import { format } from 'date-fns'

export async function generateDigestForUser(user: any) {
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
    return { skipped: true, reason: 'no_posts' }
  }

  // Check trial status
  if (user.subscription_status === 'trial' && user.trial_digest_sent) {
    console.log(`User ${user.id} trial already used, skipping`)
    return { skipped: true, reason: 'trial_used' }
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
