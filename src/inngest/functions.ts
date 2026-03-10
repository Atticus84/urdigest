import { inngest } from './client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  generateNewsletterFromNormalized,
  generateFallbackNewsletterFromNormalized,
} from '@/lib/ai/summarize'
import { normalizeInstagramPosts } from '@/lib/instagram/normalize'
import { sendDigestEmail, sendTrialEndedEmail } from '@/lib/email/send'
import { format } from 'date-fns'
import { enrichInstagramPost } from '@/lib/content-extraction/enrich'
import { SavedPost } from '@/types/database'

/**
 * Daily digest — fan-out architecture.
 *
 * Instead of processing every user sequentially inside a single long-running
 * function (which risks timeouts and blocks all users if one is slow), we:
 *   1. Fetch eligible user IDs.
 *   2. Fan out by sending a per-user event for each.
 *
 * Each per-user digest runs as its own Inngest function invocation with
 * independent retries and timeouts.
 */
export const dailyDigest = inngest.createFunction(
  { id: 'daily-digest', name: 'Generate and send daily digests' },
  { cron: '0 6 * * *' }, // Run at 6am daily
  async ({ step }) => {
    // Get all users who should receive digests
    const users = await step.run('fetch-eligible-users', async () => {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('digest_enabled', true)
        .in('subscription_status', ['trial', 'active'])

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`)
      }

      return data || []
    })

    if (users.length === 0) {
      return { dispatched: 0 }
    }

    console.log(`Dispatching digest events for ${users.length} users`)

    // Fan out: send a per-user event so each digest runs independently
    await step.sendEvent(
      'fan-out-digests',
      users.map((user) => ({
        name: 'digest/generate-for-user' as const,
        data: { userId: user.id },
      }))
    )

    return { dispatched: users.length }
  }
)

/**
 * Per-user digest generation — triggered by the fan-out from dailyDigest
 * or by a manual trigger. Each invocation is independent with its own
 * retry budget and timeout.
 */
export const generateUserDigest = inngest.createFunction(
  {
    id: 'generate-user-digest',
    name: 'Generate and send digest for a single user',
    retries: 2,
  },
  { event: 'digest/generate-for-user' },
  async ({ event, step }) => {
    const userId = event.data.userId as string
    if (!userId) {
      throw new Error('Missing userId in event data')
    }

    const user = await step.run('fetch-user', async () => {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw new Error(`Failed to fetch user ${userId}: ${error.message}`)
      return data
    })

    if (!user) {
      return { skipped: true, reason: 'user_not_found' }
    }

    return await generateDigestForUser(user, step)
  }
)

async function generateDigestForUser(user: any, step?: any) {
  // Helper: wrap in step.run if step is available (Inngest context),
  // otherwise run directly (for manual/testing use).
  const run = step
    ? <T>(id: string, fn: () => Promise<T>) => step.run(id, fn)
    : <T>(_id: string, fn: () => Promise<T>) => fn()

  // Get ALL unprocessed posts (not just last 24h — posts saved days ago
  // shouldn't be silently dropped if they missed a digest window)
  const posts: SavedPost[] = await run('fetch-posts', async () => {
    const { data, error } = await supabaseAdmin
      .from('saved_posts')
      .select('*')
      .eq('user_id', user.id)
      .eq('processed', false)
      .order('saved_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`)
    }

    return (data || []) as SavedPost[]
  })

  // Skip if no posts
  if (posts.length === 0) {
    console.log(`No posts for user ${user.id}, skipping`)
    return { skipped: true }
  }

  // Check trial status
  if (user.subscription_status === 'trial' && user.trial_digest_sent) {
    console.log(`User ${user.id} trial already used, skipping`)
    return { skipped: true }
  }

  // Normalize posts once, use everywhere (avoids deprecated legacy paths)
  const normalizedItems = normalizeInstagramPosts(posts)

  // Generate AI newsletter
  const { newsletter, tokensUsed, aiCost } = await run('generate-newsletter', async () => {
    try {
      const result = await generateNewsletterFromNormalized(normalizedItems)
      return {
        newsletter: result.newsletter,
        tokensUsed: result.tokensUsed,
        aiCost: result.cost,
      }
    } catch (error) {
      console.error('AI newsletter generation failed, using fallback:', error)
      return {
        newsletter: generateFallbackNewsletterFromNormalized(normalizedItems),
        tokensUsed: 0,
        aiCost: 0,
      }
    }
  })

  const dateStr = format(new Date(), 'MMMM d, yyyy')

  // Send to owner
  const ownerEmailId = await run('send-owner-email', async () => {
    return sendDigestEmail(user.email, newsletter, dateStr, posts.length)
  })

  // Send to legacy recipients and followers
  const { followersSentCount } = await run('send-recipient-emails', async () => {
    // Get additional recipients (legacy)
    const { data: recipients } = await supabaseAdmin
      .from('digest_recipients')
      .select('email')
      .eq('user_id', user.id)
      .eq('confirmed', true)

    // Get followers
    const { data: followers } = await supabaseAdmin
      .from('digest_followers')
      .select('email, unsubscribe_token')
      .eq('user_id', user.id)
      .eq('confirmed', true)
      .is('unsubscribed_at', null)

    const digestName = user.digest_name || `${user.instagram_username || user.email}'s digest`
    const sentEmails = new Set<string>([user.email])
    let followerCount = 0

    // Legacy recipients
    if (recipients && recipients.length > 0) {
      for (const r of recipients) {
        if (!sentEmails.has(r.email)) {
          sentEmails.add(r.email)
          await sendDigestEmail(r.email, newsletter, dateStr, posts.length)
        }
      }
    }

    // Followers
    if (followers && followers.length > 0) {
      for (const f of followers) {
        if (sentEmails.has(f.email)) continue
        try {
          await sendDigestEmail(f.email, newsletter, dateStr, posts.length, {
            unsubscribeToken: f.unsubscribe_token,
            creatorName: digestName,
            followSlug: user.follow_slug || null,
          })
          followerCount++
        } catch (err) {
          console.error(`Failed to send to follower ${f.email}:`, err)
        }
      }
    }

    return { followersSentCount: followerCount }
  })

  // Save digest record and mark posts as processed
  await run('save-digest-record', async () => {
    await supabaseAdmin.from('digests').insert({
      user_id: user.id,
      subject: newsletter.subject_line,
      summary: newsletter.big_picture || null,
      post_ids: posts.map((p) => p.id),
      post_count: posts.length,
      ai_tokens_used: tokensUsed,
      ai_cost_usd: aiCost.toString(),
      resend_email_id: ownerEmailId,
      sent_to_followers_count: followersSentCount,
    })

    await supabaseAdmin
      .from('saved_posts')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .in(
        'id',
        posts.map((p) => p.id)
      )
  })

  // Update user stats atomically to prevent race conditions (#2)
  await run('update-user-stats', async () => {
    const isTrialUser = user.subscription_status === 'trial'

    await supabaseAdmin.rpc('increment_digests_sent', {
      p_user_id: user.id,
      p_mark_trial_used: isTrialUser,
    })

    if (isTrialUser) {
      await sendTrialEndedEmail(user.email)
    }
  })

  console.log(`Digest sent successfully for user ${user.id}`)

  return {
    success: true,
    postsCount: posts.length,
    tokensUsed,
    cost: aiCost,
  }
}

// Manual trigger for testing — dispatches the same per-user event
export const manualDigest = inngest.createFunction(
  { id: 'manual-digest', name: 'Manually trigger digest for a user' },
  { event: 'digest/manual' },
  async ({ event, step }) => {
    const { userId } = event.data

    const user = await step.run('fetch-user', async () => {
      const { data } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (!data) throw new Error('User not found')
      return data
    })

    return await generateDigestForUser(user, step)
  }
)

export const enrichSavedPost = inngest.createFunction(
  { id: 'enrich-saved-post', name: 'Enrich newly saved post' },
  { event: 'saved-post/enrich.requested' },
  async ({ event, step }) => {
    const postId = String((event.data as { postId?: string } | undefined)?.postId || '')
    if (!postId) {
      throw new Error('Missing postId in event payload')
    }

    const post = await step.run('fetch-saved-post', async () => {
      const { data, error } = await supabaseAdmin
        .from('saved_posts')
        .select('*')
        .eq('id', postId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw new Error(`Failed to fetch post ${postId}: ${error.message}`)
      }

      return data as SavedPost
    })

    if (!post) {
      return {
        success: false,
        skipped: true,
        reason: 'post_not_found',
        postId,
      }
    }

    const alreadyCompleted =
      post.processing_status === 'completed' &&
      Boolean(post.transcript_text || post.transcript_summary || post.ocr_text)

    if (alreadyCompleted) {
      return {
        success: true,
        skipped: true,
        reason: 'already_completed',
        postId,
      }
    }

    const result = await step.run('enrich-saved-post', async () => {
      return enrichInstagramPost(post)
    })

    return {
      success: result.success,
      postId: result.postId,
      transcriptExtracted: result.transcriptExtracted,
      summaryGenerated: Boolean(result.transcriptSummary),
      ocrExtracted: result.ocrExtracted,
      confidence: result.confidence,
      error: result.error,
    }
  }
)
