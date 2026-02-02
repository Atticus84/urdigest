import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { sendFollowerConfirmationEmail } from '@/lib/email/send'

export const dynamic = 'force-dynamic'

const SubscribeSchema = z.object({
  email: z.string().email(),
})

// GET - get public follow page data
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, digest_name, digest_description, follow_slug, sharing_enabled, follower_count, instagram_username')
      .eq('follow_slug', params.slug)
      .eq('sharing_enabled', true)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Get most recent digest for preview
    const { data: recentDigest } = await supabaseAdmin
      .from('digests')
      .select('id, subject, summary, post_count, sent_at')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      digest_name: user.digest_name || `${user.instagram_username || 'Someone'}'s Digest`,
      description: user.digest_description || null,
      follower_count: user.follower_count,
      recent_digest: recentDigest || null,
    })
  } catch (error) {
    console.error('Get follow page error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - subscribe to a digest via public follow link
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json()
    const { email } = SubscribeSchema.parse(body)

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, digest_name, instagram_username, sharing_enabled')
      .eq('follow_slug', params.slug)
      .eq('sharing_enabled', true)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Digest not found' }, { status: 404 })
    }

    const digestName = user.digest_name || `${user.instagram_username || 'Someone'}'s Digest`

    // Check for existing follower
    const { data: existing } = await supabaseAdmin
      .from('digest_followers')
      .select('id, confirmed, unsubscribed_at')
      .eq('user_id', user.id)
      .eq('email', email)
      .single()

    if (existing) {
      if (existing.unsubscribed_at) {
        // Re-subscribe
        await supabaseAdmin
          .from('digest_followers')
          .update({
            unsubscribed_at: null,
            confirmed: false,
            confirmed_at: null,
            source: 'link',
          })
          .eq('id', existing.id)

        const { data: follower } = await supabaseAdmin
          .from('digest_followers')
          .select('confirmation_token')
          .eq('id', existing.id)
          .single()

        if (follower) {
          await sendFollowerConfirmationEmail(email, digestName, follower.confirmation_token)
        }

        return NextResponse.json({ success: true, message: 'Confirmation email sent' })
      }

      if (existing.confirmed) {
        return NextResponse.json({ success: true, message: 'You are already subscribed' })
      }

      // Resend confirmation
      const { data: follower } = await supabaseAdmin
        .from('digest_followers')
        .select('confirmation_token')
        .eq('id', existing.id)
        .single()

      if (follower) {
        await sendFollowerConfirmationEmail(email, digestName, follower.confirmation_token)
      }

      return NextResponse.json({ success: true, message: 'Confirmation email sent' })
    }

    // Rate limit: max 50 followers
    const { count } = await supabaseAdmin
      .from('digest_followers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('unsubscribed_at', null)

    if (count !== null && count >= 50) {
      return NextResponse.json(
        { error: 'This digest has reached its follower limit' },
        { status: 400 }
      )
    }

    // Create follower
    const { data: newFollower, error: insertError } = await supabaseAdmin
      .from('digest_followers')
      .insert({
        user_id: user.id,
        email,
        source: 'link',
      })
      .select('confirmation_token')
      .single()

    if (insertError) throw insertError

    if (newFollower) {
      await sendFollowerConfirmationEmail(email, digestName, newFollower.confirmation_token)
    }

    return NextResponse.json({ success: true, message: 'Confirmation email sent' }, { status: 201 })
  } catch (error) {
    console.error('Subscribe error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
