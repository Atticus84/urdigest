import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { summarizePosts, generateFallbackSummaries } from '@/lib/ai/summarize'
import { sendDigestEmail } from '@/lib/email/send'
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
    const { data: userData, error: userError } = await supabaseAdmin
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

    // Check trial
    if (userData.subscription_status === 'trial' && userData.trial_digest_sent) {
      return NextResponse.json({ error: 'Trial digest already sent. Please upgrade to continue.' }, { status: 400 })
    }

    // Validate email - don't send to placeholder addresses
    if (!userData.email || userData.email.includes('@placeholder.urdigest')) {
      return NextResponse.json({
        error: 'No valid email address on file. Please update your email in settings.',
        email: userData.email,
      }, { status: 400 })
    }

    // Get ALL unprocessed posts (no time filter for manual sends)
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('saved_posts')
      .select('*')
      .eq('user_id', user.id)
      .eq('processed', false)
      .order('saved_at', { ascending: false })

    if (postsError) {
      return NextResponse.json({ error: `Failed to fetch posts: ${postsError.message}` }, { status: 500 })
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        error: 'No unprocessed posts to include in digest. Share some Instagram posts first!',
      }, { status: 400 })
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
    const dateStr = format(new Date(), 'MMMM d, yyyy')
    const resendEmailId = await sendDigestEmail(userData.email, emailPosts, dateStr)

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
      total_digests_sent: (userData.total_digests_sent || 0) + 1,
    }

    if (userData.subscription_status === 'trial') {
      updates.trial_digest_sent = true
    }

    await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', user.id)

    return NextResponse.json({
      success: true,
      message: `Digest sent to ${userData.email} with ${posts.length} post(s)`,
      postsCount: posts.length,
      email: userData.email,
      resendEmailId,
    })
  } catch (error) {
    console.error('Manual digest send error:', error)
    return NextResponse.json({
      error: 'Failed to send digest',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
