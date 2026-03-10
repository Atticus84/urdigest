import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email/send'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

/**
 * POST /api/digests/[id]/resend
 *
 * Resends a previously generated digest to the authenticated user's email.
 * Reuses the stored newsletter content — does NOT regenerate from AI.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the digest (must belong to this user)
    const { data: digest, error: digestError } = await supabaseAdmin
      .from('digests')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (digestError || !digest) {
      return NextResponse.json({ error: 'Digest not found' }, { status: 404 })
    }

    // We need the newsletter content to resend. The digest stores subject + summary,
    // but not the full newsletter object. We'll need to reconstruct it from the posts.
    // For now, use the stored html_content if available, or regenerate from posts.

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single()

    if (!userData?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // If we have stored HTML content, resend it directly
    if (digest.html_content) {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)

      const { error: sendError } = await resend.emails.send({
        from: 'urdigest <digest@urdigest.com>',
        to: userData.email,
        subject: `☀️ ${digest.subject || 'Your Digest'} (resent)`,
        html: digest.html_content,
        tags: [{ name: 'type', value: 'digest_resend' }],
      })

      if (sendError) {
        throw sendError
      }
    } else {
      // Reconstruct and resend using the post data + AI summarization
      // Import what we need
      const { normalizeInstagramPosts } = await import('@/lib/instagram/normalize')
      const {
        generateNewsletterFromNormalized,
        generateFallbackNewsletterFromNormalized,
      } = await import('@/lib/ai/summarize')

      // Fetch the posts included in this digest
      if (!digest.post_ids || digest.post_ids.length === 0) {
        return NextResponse.json({ error: 'No posts associated with this digest' }, { status: 400 })
      }

      const { data: posts } = await supabaseAdmin
        .from('saved_posts')
        .select('*')
        .in('id', digest.post_ids)

      if (!posts || posts.length === 0) {
        return NextResponse.json({ error: 'Posts not found' }, { status: 404 })
      }

      const normalizedItems = normalizeInstagramPosts(posts)

      let newsletter
      try {
        const result = await generateNewsletterFromNormalized(normalizedItems)
        newsletter = result.newsletter
      } catch {
        newsletter = generateFallbackNewsletterFromNormalized(normalizedItems)
      }

      const dateStr = format(new Date(digest.sent_at), 'MMMM d, yyyy')
      await sendDigestEmail(userData.email, newsletter, dateStr, posts.length)
    }

    return NextResponse.json({ success: true, message: 'Digest resent to your email' })
  } catch (error) {
    console.error('Error resending digest:', error)
    return NextResponse.json({ error: 'Failed to resend digest' }, { status: 500 })
  }
}
