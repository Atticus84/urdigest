'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import type { Digest, User, SavedPost } from '@/types/database'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [digests, setDigests] = useState<Digest[]>([])
  const [recentPosts, setRecentPosts] = useState<SavedPost[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = async () => {
    const supabase = createClient()
    const { data: { user: authUser }, error } = await supabase.auth.getUser()
    if (error || !authUser) {
      router.push('/login')
      return
    }

    const userData = await ensureUserProfile(supabase, authUser.id, authUser.email || '')
    if (!userData) {
      console.error('Failed to load user profile')
      setLoading(false)
      return
    }
    setUser(userData)

    try {
      const res = await fetch('/api/digests/list')
      if (res.ok) {
        const data = await res.json()
        setDigests((data.digests || []).slice(0, 5))
      }
    } catch (err) {
      console.error('Failed to load digests:', err)
    }

    const { data: posts } = await supabase
      .from('saved_posts')
      .select('*')
      .eq('user_id', authUser.id)
      .order('saved_at', { ascending: false })
      .limit(6)
    setRecentPosts(posts || [])

    const { count } = await supabase
      .from('saved_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authUser.id)
      .eq('processed', false)
    setPendingCount(count || 0)

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-instagram-pink mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Welcome */}
      <div className="mb-5 md:mb-8">
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-0.5">
          {getGreeting()}{user?.instagram_username ? `, @${user.instagram_username}` : ''}
        </h1>
        <p className="text-gray-400 text-xs md:text-sm">
          Here&apos;s your urdigest overview
        </p>
      </div>

      {/* Stats — 2x2 grid always, compact on mobile */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4 mb-6 md:mb-10">
        <StatCard label="Posts Saved" value={user?.total_posts_saved || 0} icon="📌" />
        <StatCard label="Digests Sent" value={user?.total_digests_sent || 0} icon="📬" />
        <StatCard label="Pending" value={pendingCount} icon="⏳" accent={pendingCount > 0} />
        <StatCard label="Followers" value={user?.follower_count || 0} icon="👥" />
      </div>

      {/* Quick Actions — horizontal scroll on mobile, grid on desktop */}
      <div className="mb-6 md:mb-10 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <Link
            href="/dashboard/library"
            className="flex items-center gap-3 p-4 md:p-5 bg-white border border-gray-100 rounded-xl active:bg-gray-50 transition group shrink-0 w-[70vw] md:w-auto"
          >
            <span className="text-xl md:text-2xl">📚</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Browse Library</p>
              <p className="text-[11px] md:text-xs text-gray-400">Search all your saves</p>
            </div>
          </Link>
          <Link
            href="/dashboard/ask"
            className="flex items-center gap-3 p-4 md:p-5 bg-white border border-gray-100 rounded-xl active:bg-gray-50 transition group shrink-0 w-[70vw] md:w-auto"
          >
            <span className="text-xl md:text-2xl">🧠</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Ask AI</p>
              <p className="text-[11px] md:text-xs text-gray-400">Chat with your content</p>
            </div>
          </Link>
          <Link
            href="/dashboard/sharing"
            className="flex items-center gap-3 p-4 md:p-5 bg-white border border-gray-100 rounded-xl active:bg-gray-50 transition group shrink-0 w-[70vw] md:w-auto"
          >
            <span className="text-xl md:text-2xl">🔗</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Share Digest</p>
              <p className="text-[11px] md:text-xs text-gray-400">Grow your followers</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Saves — photo grid */}
      {recentPosts.length > 0 && (
        <div className="mb-6 md:mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs md:text-sm font-semibold text-gray-900 uppercase tracking-wider">Recent Saves</h2>
            <Link href="/dashboard/library" className="text-xs text-gray-400 active:text-instagram-pink">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-1.5 md:gap-2">
            {recentPosts.map((post) => (
              <Link key={post.id} href="/dashboard/library" className="group">
                <div className="aspect-square rounded-lg md:rounded-xl overflow-hidden bg-gray-100 relative">
                  {post.thumbnail_url ? (
                    <img
                      src={post.thumbnail_url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <span className="text-lg">📌</span>
                    </div>
                  )}
                  {post.post_type && (
                    <span className="absolute bottom-1 left-1 text-[8px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded-full uppercase">
                      {post.post_type}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Digests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs md:text-sm font-semibold text-gray-900 uppercase tracking-wider">Recent Digests</h2>
        </div>

        {digests.length === 0 ? (
          <div className="text-center py-10 bg-gray-50/50 rounded-xl border border-gray-100">
            <p className="text-gray-400 text-sm mb-1">No digests yet</p>
            <p className="text-gray-300 text-xs">Save some posts and your first digest will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {digests.map((digest) => {
              const sentDate = new Date(digest.sent_at)
              return (
                <Link
                  key={digest.id}
                  href={`/dashboard/digests/${digest.id}`}
                  className="block bg-white border border-gray-100 rounded-xl p-3.5 md:p-4 active:bg-gray-50 transition group"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {digest.subject || `Digest · ${format(sentDate, 'MMM d')}`}
                      </p>
                      <p className="text-[11px] md:text-xs text-gray-400 mt-0.5">
                        {digest.post_count} posts · {format(sentDate, 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-gray-400 ml-3 shrink-0">
                      →
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: string; accent?: boolean }) {
  return (
    <div className={`bg-white border rounded-xl p-3 md:p-4 ${accent ? 'border-instagram-pink/30' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-1 md:mb-2">
        <span className="text-base md:text-lg">{icon}</span>
        {accent && <span className="w-1.5 h-1.5 bg-instagram-pink rounded-full animate-pulse" />}
      </div>
      <p className={`text-xl md:text-2xl font-bold ${accent ? 'text-instagram-pink' : 'text-gray-900'}`}>{value}</p>
      <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
