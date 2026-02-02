'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import type { SavedPost, User } from '@/types/database'

type Filter = 'all' | 'pending' | 'digested'

export default function SavedPostsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<SavedPost[]>([])
  const [pendingPosts, setPendingPosts] = useState<SavedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingDigest, setSendingDigest] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const supabase = createClient()

    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user) {
      setLoading(false)
      return
    }

    const userData = await ensureUserProfile(supabase, authUser.user.id, authUser.user.email!)
    setUser(userData)

    const { data: postsData } = await supabase
      .from('saved_posts')
      .select('*')
      .eq('user_id', authUser.user.id)
      .order('saved_at', { ascending: false })
      .limit(50)

    setPosts(postsData || [])
    await loadPendingDigest()
    setLoading(false)
  }

  const loadPendingDigest = async () => {
    try {
      const response = await fetch('/api/digests/pending')
      if (response.ok) {
        const data = await response.json()
        setPendingPosts(data.posts || [])
      }
    } catch (error) {
      console.error('Failed to load pending digest:', error)
    }
  }

  const sendDigestManually = async () => {
    if (pendingPosts.length === 0) return
    setSendingDigest(true)
    try {
      const response = await fetch('/api/digests/send', { method: 'POST' })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send digest')
      }
      alert('Digest sent successfully! Check your email.')
      await loadData()
    } catch (error: any) {
      alert(error.message || 'Failed to send digest')
    } finally {
      setSendingDigest(false)
    }
  }

  const deletePost = async (id: string) => {
    const supabase = createClient()
    await supabase.from('saved_posts').delete().eq('id', id)
    setPosts(posts.filter(p => p.id !== id))
    setPendingPosts(pendingPosts.filter(p => p.id !== id))
  }

  const pendingIds = new Set(pendingPosts.map(p => p.id))

  const filteredPosts = posts.filter((post) => {
    if (filter === 'pending') return !post.processed
    if (filter === 'digested') return post.processed
    return true
  })

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-instagram-pink mx-auto mb-4"></div>
        <p className="text-gray-400 text-sm">Loading your posts...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Saved Posts</h1>
          <p className="text-gray-400 text-sm">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'} saved
          </p>
        </div>
        {pendingPosts.length > 0 && (
          <button
            onClick={sendDigestManually}
            disabled={sendingDigest}
            className="text-sm font-medium bg-instagram-pink text-white px-4 py-2 rounded-lg hover:bg-instagram-pink/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingDigest ? 'Sending...' : `Send Digest Now (${pendingPosts.length})`}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 border-b border-gray-100 pb-4">
        {[
          { key: 'all' as Filter, label: 'All' },
          { key: 'pending' as Filter, label: 'Not yet digested' },
          { key: 'digested' as Filter, label: 'Already digested' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-sm font-medium transition ${
              filter === f.key ? 'text-instagram-pink' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts list */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-16">
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            {posts.length === 0 ? 'No posts yet' : 'No posts match this filter'}
          </h2>
          {posts.length === 0 && (
            <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
              Share Instagram posts to @urdigest via DM to get started.
              They'll appear here and in your daily digest.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-0">
          {filteredPosts.map((post, index) => (
            <div
              key={post.id}
              className={`flex items-start gap-4 py-4 ${
                index < filteredPosts.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              {/* Thumbnail */}
              {post.thumbnail_url ? (
                <img
                  src={post.thumbnail_url}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-50 shrink-0 flex items-center justify-center">
                  <span className="text-gray-300 text-lg">&#9634;</span>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {post.author_username && (
                      <p className="text-sm font-medium text-gray-900">
                        @{post.author_username}
                      </p>
                    )}
                    {post.caption && (
                      <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">
                        {post.caption}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-gray-300">
                    Saved {format(new Date(post.saved_at), 'MMM d')}
                  </span>
                  <span className={`text-xs font-medium ${
                    post.processed
                      ? 'text-instagram-purple'
                      : pendingIds.has(post.id)
                        ? 'text-instagram-pink'
                        : 'text-gray-400'
                  }`}>
                    {post.processed
                      ? 'Included in digest'
                      : pendingIds.has(post.id)
                        ? 'Queued for next digest'
                        : 'Not yet digested'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={post.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-instagram-pink font-medium transition"
                >
                  View
                </a>
                <button
                  onClick={() => deletePost(post.id)}
                  className="text-xs text-gray-300 hover:text-red-500 font-medium transition"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
