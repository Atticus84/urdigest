import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { summarizePosts, generateFallbackSummaries } from '@/lib/ai/summarize'
import { sendDigestEmail, sendTrialEndedEmail } from '@/lib/email/send'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user exists in users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has digest enabled and valid subscription
    if (!userData.digest_enabled) {
      return NextResponse.json({ error: 'Digest is disabled for this user' }, { status: 400 })
    }

    if (!['trial', 'active'].includes(userData.subscription_status)) {
      return NextResponse.json({ error: 'Invalid subscription status' }, { status: 400 })
    }

    // Check trial status
    if (userData.subscription_status === 'trial' && userData.trial_digest_sent) {
      return NextResponse.json({ error: 'Trial digest already sent' }, { status: 400 })
    }

    // Fetch unprocessed posts from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: posts, error: postsError } = await supabaseAdmin
      .from('saved_posts')
      .select('*')
      .eq('user_id', user.id)
      .eq('processed', false)
      .gte('saved_at', yesterday)
      .order('saved_at', { ascending: false })

    if (postsError) {
      console.error('Failed to fetch posts:', postsError)
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ error: 'No pending posts to include in digest' }, { status: 400 })
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

    // Send email directly
    const resendEmailId = await sendDigestEmail(
      userData.email,
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
      total_digests_sent: userData.total_digests_sent + 1,
    }

    if (userData.subscription_status === 'trial') {
      updates.trial_digest_sent = true
      await sendTrialEndedEmail(userData.email)
    }

    await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', user.id)

    return NextResponse.json({
      success: true,
      message: 'Digest sent successfully',
      postsCount: posts.length,
      resendEmailId,
    })
  } catch (error: any) {
    console.error('Failed to send digest:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send digest' },
      { status: 500 }
    )
  }
}
