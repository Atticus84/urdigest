'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import type { Digest, User, SavedPost } from '@/types/database'

function estimateReadTime(postCount: number): number {
  return Math.max(1, Math.round(postCount * 0.8))
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [digests, setDigests] = useState<Digest[]>([])
  const [recentPosts, setRecentPosts] = useState<SavedPost[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { setLoading(false); return }

    const userData = await ensureUserProfile(supabase, authUser.id, authUser.email!)
    setUser(userData)

    // Load digests
    try {
      const res = await fetch('/api/digests/list')
      if (res.ok) {
        const data = await res.json()
        setDigests((data.digests || []).slice(0, 5))
      }
    } catch {}

    // Load recent posts
    const { data: posts } = await supabase
      .from('saved_posts')
      .select('*')
      .eq('user_id', authUser.id)
      .order('saved_at', { ascending: false })
      .limit(6)
    setRecentPosts(posts || [])

    // Count pending
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
        <p className="text-gray-400 text-sm">Loading your dashboard...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          {getGreeting()}{user?.instagram_username ? `, @${user.instagram_username}` : ''}
        </h1>
        <p className="text-gray-400 text-sm">
          Here&apos;s your urdigest overview
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Posts Saved" value={user?.total_posts_saved || 0} icon="📌" />
        <StatCard label="Digests Sent" value={user?.total_digests_sent || 0} icon="📬" />
        <StatCard label="Pending" value={pendingCount} icon="⏳" accent={pendingCount > 0} />
        <StatCard label="Followers" value={user?.follower_count || 0} icon="👥" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Link
          href="/dashboard/library"
          className="flex items-center gap-4 p-5 bg-white border border-gray-100 rounded-xl hover:border-instagram-pink/30 hover:shadow-sm transition group"
        >
          <span className="text-2xl">📚</span>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-instagram-pink transition">Browse Library</p>
            <p className="text-xs text-gray-400">Search and filter all your saves</p>
          </div>
        </Link>
        <Link
          href="/dashboard/ask"
          className="flex items-center gap-4 p-5 bg-white border border-gray-100 rounded-xl hover:border-instagram-pink/30 hover:shadow-sm transition group"
        >
          <span className="text-2xl">🧠</span>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-instagram-pink transition">Ask AI</p>
            <p className="text-xs text-gray-400">Chat with your saved content</p>
          </div>
        </Link>
        <Link
          href="/dashboard/sharing"
          className="flex items-center gap-4 p-5 bg-white border border-gray-100 rounded-xl hover:border-instagram-pink/30 hover:shadow-sm transition group"
        >
          <span className="text-2xl">🔗</span>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-instagram-pink transition">Share Digest</p>
            <p className="text-xs text-gray-400">Grow your followers</p>
          </div>
        </Link>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Recent Digests */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Recent Digests</h2>
          </div>

          {digests.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/50 rounded-xl border border-gray-100">
              <p className="text-gray-400 text-sm mb-3">No digests yet</p>
              <p className="text-gray-300 text-xs">Save some posts and your first digest will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {digests.map((digest) => {
                const sentDate = new Date(digest.sent_at)
                return (
                  <Link
                    key={digest.id}
                    href={`/dashboard/digests/${digest.id}`}
                    className="block bg-white border border-gray-100 rounded-xl p-4 hover:border-instagram-pink/30 hover:shadow-sm transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{digest.subject || `Digest · ${format(sentDate, 'MMM d')}`}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {digest.post_count} posts · {format(sentDate, 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-gray-400 group-hover:text-instagram-pink transition">
                        View →
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Saves */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Recent Saves</h2>
            <Link href="/dashboard/library" className="text-xs text-gray-400 hover:text-instagram-pink transition">
              View all
            </Link>
          </div>

          {recentPosts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/50 rounded-xl border border-gray-100">
              <p className="text-gray-400 text-sm">No posts saved yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {recentPosts.map((post) => (
                <Link
                  key={post.id}
                  href="/dashboard/library"
                  className="group"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative">
                    {post.thumbnail_url ? (
                      <img
                        src={post.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: string; accent?: boolean }) {
  return (
    <div className={`bg-white border rounded-xl p-4 ${accent ? 'border-instagram-pink/30' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
        {accent && <span className="w-2 h-2 bg-instagram-pink rounded-full animate-pulse" />}
      </div>
      <p className={`text-2xl font-bold ${accent ? 'text-instagram-pink' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
