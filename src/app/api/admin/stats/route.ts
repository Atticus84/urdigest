import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch all users
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, created_at, subscription_status, total_posts_saved, total_digests_sent, digest_enabled, instagram_username, last_post_received_at, trial_digest_sent')
      .order('created_at', { ascending: false })

    if (usersError) throw usersError

    // Fetch recent digests
    const { data: recentDigests, error: digestsError } = await supabaseAdmin
      .from('digests')
      .select('id, user_id, subject, post_count, sent_at, opened_at')
      .order('sent_at', { ascending: false })
      .limit(50)

    if (digestsError) throw digestsError

    // Fetch saved posts count
    const { count: totalPosts, error: postsError } = await supabaseAdmin
      .from('saved_posts')
      .select('*', { count: 'exact', head: true })

    if (postsError) throw postsError

    // Fetch total digests count
    const { count: totalDigests, error: totalDigestsError } = await supabaseAdmin
      .from('digests')
      .select('*', { count: 'exact', head: true })

    if (totalDigestsError) throw totalDigestsError

    const stats = {
      totalUsers: users?.length ?? 0,
      activeSubscriptions: users?.filter(u => u.subscription_status === 'active').length ?? 0,
      trialUsers: users?.filter(u => u.subscription_status === 'trial').length ?? 0,
      totalPosts: totalPosts ?? 0,
      totalDigests: totalDigests ?? 0,
      users: users ?? [],
      recentDigests: recentDigests ?? [],
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
