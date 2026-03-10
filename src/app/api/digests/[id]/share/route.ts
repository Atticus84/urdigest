import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email/send'
import { format } from 'date-fns'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const shareSchema = z.object({
  emails: z
    .array(z.string().email())
    .min(1, 'At least one email is required')
    .max(10, 'Maximum 10 recipients per share'),
})

/**
 * POST /api/digests/[id]/share
 *
 * Sends a previously generated digest to one or more email addresses.
 * The emails are sent as "shared by" the authenticated user.
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

    // Validate request body
    const body = await request.json()
    const parsed = shareSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { emails } = parsed.data

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

    // Get the user's display name for the "shared by" context
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('email, instagram_username, digest_name')
      .eq('id', user.id)
      .single()

    const senderName =
      userData?.digest_name ||
      (userData?.instagram_username ? `@${userData.instagram_username}` : userData?.email || 'Someone')

    let sentCount = 0
    const errors: string[] = []

    if (digest.html_content) {
      // If we have stored HTML, send it directly with "shared by" subject
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)

      for (const email of emails) {
        try {
          await resend.emails.send({
            from: 'urdigest <digest@urdigest.com>',
            to: email,
            subject: `☀️ ${digest.subject || 'A Digest'} — shared by ${senderName}`,
            html: digest.html_content,
            tags: [{ name: 'type', value: 'digest_shared' }],
          })
          sentCount++
        } catch (err) {
          console.error(`Failed to share digest to ${email}:`, err)
          errors.push(email)
        }
      }
    } else {
      // Reconstruct newsletter from posts
      const { normalizeInstagramPosts } = await import('@/lib/instagram/normalize')
      const {
        generateNewsletterFromNormalized,
        generateFallbackNewsletterFromNormalized,
      } = await import('@/lib/ai/summarize')

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

      for (const email of emails) {
        try {
          await sendDigestEmail(email, newsletter, dateStr, posts.length, {
            unsubscribeToken: '', // No unsubscribe for one-off shares
            creatorName: senderName,
            followSlug: null,
          })
          sentCount++
        } catch (err) {
          console.error(`Failed to share digest to ${email}:`, err)
          errors.push(email)
        }
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      totalRequested: emails.length,
      ...(errors.length > 0 && { failedEmails: errors }),
    })
  } catch (error) {
    console.error('Error sharing digest:', error)
    return NextResponse.json({ error: 'Failed to share digest' }, { status: 500 })
  }
}
