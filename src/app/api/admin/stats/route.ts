import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

    // Fetch all users
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, created_at, subscription_status, total_posts_saved, total_digests_sent, digest_enabled, instagram_username, last_post_received_at, trial_digest_sent')
      .order('created_at', { ascending: false })

    if (usersError) throw usersError

    // Fetch all digests (for per-user analysis)
    const { data: allDigests, error: allDigestsError } = await supabaseAdmin
      .from('digests')
      .select('id, user_id, subject, post_count, sent_at, opened_at')
      .order('sent_at', { ascending: false })

    if (allDigestsError) throw allDigestsError

    // Fetch saved posts with timestamps for recent activity
    const { data: recentPosts, error: recentPostsError } = await supabaseAdmin
      .from('saved_posts')
      .select('user_id, saved_at')
      .gte('saved_at', sevenDaysAgo.toISOString())

    if (recentPostsError) throw recentPostsError

    // Fetch all saved posts per user for funnel (users who sent >= 1 post, >= 2 posts)
    const { data: allPosts, error: allPostsError } = await supabaseAdmin
      .from('saved_posts')
      .select('user_id, saved_at')
      .order('saved_at', { ascending: true })

    if (allPostsError) throw allPostsError

    const userList = users ?? []
    const digestList = allDigests ?? []
    const recentPostList = recentPosts ?? []
    const allPostList = allPosts ?? []

    // Build per-user post counts for last 7 days
    const postsLast7ByUser: Record<string, number> = {}
    for (const p of recentPostList) {
      postsLast7ByUser[p.user_id] = (postsLast7ByUser[p.user_id] || 0) + 1
    }

    // Build per-user digest maps
    const digestsByUser: Record<string, typeof digestList> = {}
    for (const d of digestList) {
      if (!digestsByUser[d.user_id]) digestsByUser[d.user_id] = []
      digestsByUser[d.user_id].push(d)
    }

    // Build per-user post counts (all time) and first/second post timestamps
    const postCountByUser: Record<string, number> = {}
    const firstPostByUser: Record<string, string> = {}
    const secondPostByUser: Record<string, string> = {}
    for (const p of allPostList) {
      postCountByUser[p.user_id] = (postCountByUser[p.user_id] || 0) + 1
      if (!firstPostByUser[p.user_id]) {
        firstPostByUser[p.user_id] = p.saved_at
      } else if (!secondPostByUser[p.user_id]) {
        secondPostByUser[p.user_id] = p.saved_at
      }
    }

    // --- KPI Metrics ---
    const newUsersLast7 = userList.filter(u => new Date(u.created_at) >= sevenDaysAgo).length
    const activatedUsers = userList.filter(u => (postCountByUser[u.id] || 0) >= 1).length
    const activatedWithDigest = userList.filter(u => (postCountByUser[u.id] || 0) >= 1 && (u.total_digests_sent || 0) >= 1).length
    const trialUsers = userList.filter(u => u.subscription_status === 'trial')
    const paidUsers = userList.filter(u => u.subscription_status === 'active')
    const trialToPaidPct = trialUsers.length + paidUsers.length > 0
      ? Math.round((paidUsers.length / (trialUsers.length + paidUsers.length)) * 100)
      : 0
    const activeUserCount = userList.filter(u => (postsLast7ByUser[u.id] || 0) > 0).length
    const totalPostsLast7 = recentPostList.length
    const avgPostsPerActiveUser = activeUserCount > 0
      ? (totalPostsLast7 / activeUserCount).toFixed(1)
      : '0'
    const digestsLast7 = digestList.filter(d => new Date(d.sent_at) >= sevenDaysAgo).length

    // --- Funnel ---
    const signups = userList.length
    const connectedIG = userList.filter(u => u.instagram_username).length
    const sentFirstPost = userList.filter(u => (postCountByUser[u.id] || 0) >= 1).length
    const receivedFirstDigest = userList.filter(u => (u.total_digests_sent || 0) >= 1).length
    const openedDigest = userList.filter(u => {
      const userDigests = digestsByUser[u.id] || []
      return userDigests.some(d => d.opened_at)
    }).length
    const sentSecondPost = userList.filter(u => (postCountByUser[u.id] || 0) >= 2).length

    // --- Key Activation Metric ---
    // % of users who sent a second post after receiving their first digest
    const usersWithFirstDigest = userList.filter(u => (u.total_digests_sent || 0) >= 1)
    const usersSecondPostAfterDigest = usersWithFirstDigest.filter(u => {
      const userDigests = digestsByUser[u.id] || []
      if (userDigests.length === 0) return false
      const firstDigestDate = userDigests[userDigests.length - 1].sent_at // oldest digest (list is desc)
      return secondPostByUser[u.id] && new Date(secondPostByUser[u.id]) > new Date(firstDigestDate)
    }).length
    const secondPostAfterDigestPct = usersWithFirstDigest.length > 0
      ? Math.round((usersSecondPostAfterDigest / usersWithFirstDigest.length) * 100)
      : 0

    // --- Enhanced Users ---
    const enhancedUsers = userList.map(u => {
      const userDigests = digestsByUser[u.id] || []
      const digestsOpened = userDigests.filter(d => d.opened_at).length
      const daysSinceSignup = Math.floor((now.getTime() - new Date(u.created_at).getTime()) / (1000 * 60 * 60 * 24))
      const posts7d = postsLast7ByUser[u.id] || 0
      const totalPosts = postCountByUser[u.id] || 0
      const lastActivity = u.last_post_received_at || u.created_at

      let activationStatus: string
      if (totalPosts === 0) {
        activationStatus = 'signed_up'
      } else if (totalPosts >= 1 && (u.total_digests_sent || 0) === 0) {
        activationStatus = 'activated'
      } else if (totalPosts >= 2 && (u.total_digests_sent || 0) >= 1) {
        activationStatus = 'habit_forming'
      } else if (totalPosts >= 1 && (u.total_digests_sent || 0) >= 1 && posts7d === 0 && daysSinceSignup > 7) {
        activationStatus = 'at_risk'
      } else {
        activationStatus = 'activated'
      }

      // Override: if no activity in 14+ days and had some posts, mark churned
      const daysSinceLastActivity = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
      if (totalPosts > 0 && daysSinceLastActivity > 14) {
        activationStatus = 'churned'
      }

      return {
        ...u,
        posts_last_7d: posts7d,
        digests_opened: digestsOpened,
        days_since_signup: daysSinceSignup,
        activation_status: activationStatus,
        last_activity: lastActivity,
      }
    })

    // --- Digest Performance ---
    const recentDigestsLimited = digestList.slice(0, 50)
    const totalDigestsSent = digestList.length
    const totalDigestsOpened = digestList.filter(d => d.opened_at).length
    const overallOpenRate = totalDigestsSent > 0
      ? Math.round((totalDigestsOpened / totalDigestsSent) * 100)
      : 0

    // --- Alerts ---
    const alerts: string[] = []

    const staleSignups = userList.filter(u =>
      new Date(u.created_at) <= fortyEightHoursAgo &&
      new Date(u.created_at) >= sevenDaysAgo &&
      (postCountByUser[u.id] || 0) === 0
    ).length
    if (staleSignups > 0) {
      alerts.push(`${staleSignups} user${staleSignups > 1 ? 's' : ''} signed up 48h+ ago but sent 0 posts`)
    }

    const postsNoDigest = userList.filter(u =>
      (postCountByUser[u.id] || 0) >= 1 && (u.total_digests_sent || 0) === 0
    ).length
    if (postsNoDigest > 0) {
      alerts.push(`${postsNoDigest} user${postsNoDigest > 1 ? 's' : ''} sent posts but never received a digest`)
    }

    const activeCount = userList.filter(u => (postsLast7ByUser[u.id] || 0) > 0).length
    if (activeCount > 0 && activeCount <= 3) {
      alerts.push(`${activeCount} active user${activeCount > 1 ? 's' : ''} this week — consider interviewing`)
    }

    const atRiskUsers = enhancedUsers.filter(u => u.activation_status === 'at_risk').length
    if (atRiskUsers > 0) {
      alerts.push(`${atRiskUsers} user${atRiskUsers > 1 ? 's' : ''} at risk of churning (no activity in 7+ days)`)
    }

    const stats = {
      // KPIs
      newUsersLast7,
      activatedUsers,
      activatedWithDigest,
      trialToPaidPct,
      avgPostsPerActiveUser,
      digestsLast7,
      // Key metric
      secondPostAfterDigestPct,
      // Funnel
      funnel: {
        signups,
        connectedIG,
        sentFirstPost,
        receivedFirstDigest,
        openedDigest,
        sentSecondPost,
      },
      // Digest performance
      digestPerformance: {
        totalSent: totalDigestsSent,
        totalOpened: totalDigestsOpened,
        openRate: overallOpenRate,
      },
      // Enhanced data
      users: enhancedUsers,
      recentDigests: recentDigestsLimited,
      // Alerts
      alerts,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
