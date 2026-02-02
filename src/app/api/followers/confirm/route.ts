import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET - confirm a follower's email via token
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/?error=invalid-token', request.url))
  }

  try {
    const { data: follower, error } = await supabaseAdmin
      .from('digest_followers')
      .select('id, user_id, confirmed')
      .eq('confirmation_token', token)
      .single()

    if (error || !follower) {
      return NextResponse.redirect(new URL('/?error=invalid-token', request.url))
    }

    if (!follower.confirmed) {
      await supabaseAdmin
        .from('digest_followers')
        .update({
          confirmed: true,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', follower.id)

      // Update follower count
      await supabaseAdmin.rpc('increment_follower_count', { uid: follower.user_id })
        .then(() => {})
        .catch(async () => {
          // Fallback: count manually
          const { count } = await supabaseAdmin
            .from('digest_followers')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', follower.user_id)
            .eq('confirmed', true)
            .is('unsubscribed_at', null)

          await supabaseAdmin
            .from('users')
            .update({ follower_count: count || 0 })
            .eq('id', follower.user_id)
        })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    return NextResponse.redirect(new URL('/follow/confirmed', appUrl))
  } catch (error) {
    console.error('Confirm follower error:', error)
    return NextResponse.redirect(new URL('/?error=confirmation-failed', request.url))
  }
}
