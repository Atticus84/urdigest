'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import type { SavedPost, User } from '@/types/database'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<SavedPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const supabase = createClient()

    // Get user profile
    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user) {
      setLoading(false)
      return
    }

    const userData = await ensureUserProfile(supabase, authUser.user.id, authUser.user.email!)
    setUser(userData)

    // Get saved posts
    const { data: postsData } = await supabase
      .from('saved_posts')
      .select('*')
      .eq('user_id', authUser.user.id)
      .order('saved_at', { ascending: false })
      .limit(50)

    setPosts(postsData || [])
    setLoading(false)
  }

  const deletePost = async (id: string) => {
    const supabase = createClient()
    await supabase
      .from('saved_posts')
      .delete()
      .eq('id', id)

    setPosts(posts.filter(p => p.id !== id))
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-instagram-pink mx-auto mb-4"></div>
        <p className="text-gray-600">Loading your posts...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Your Saved Posts
        </h1>
        <p className="text-gray-600">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'} saved
        </p>
      </div>

      {/* Trial Banner */}
      {user && user.subscription_status === 'trial' && !user.trial_digest_sent && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎉</span>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">
                Welcome to urdigest!
              </h3>
              <p className="text-blue-700 text-sm mb-3">
                Your first digest is free. Share Instagram posts to @urdigest to get started.
              </p>
              <p className="text-blue-600 text-xs">
                After your first digest, upgrade to Premium for $5/month to continue.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trial Ended Banner */}
      {user && user.subscription_status === 'trial' && user.trial_digest_sent && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏰</span>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 mb-1">
                Your trial has ended
              </h3>
              <p className="text-yellow-700 text-sm mb-3">
                Upgrade to Premium to continue receiving daily digests.
              </p>
              <a
                href="/dashboard/subscription"
                className="inline-block bg-instagram-pink text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-instagram-pink/90 transition"
              >
                Upgrade to Premium →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {user && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Total Posts Saved</div>
            <div className="text-3xl font-bold text-gray-900">{user.total_posts_saved}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Digests Sent</div>
            <div className="text-3xl font-bold text-gray-900">{user.total_digests_sent}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Subscription</div>
            <div className="text-xl font-bold text-gray-900 capitalize">
              {user.subscription_status === 'trial' ? (
                user.trial_digest_sent ? 'Trial Ended' : 'Trial Active'
              ) : (
                user.subscription_status
              )}
            </div>
          </div>
        </div>
      )}

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No posts yet
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Share Instagram posts to @urdigest via DM to get started. They'll appear here and in your daily digest.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto text-left">
            <p className="text-sm font-semibold text-gray-900 mb-2">Quick start:</p>
            <ol className="text-sm text-gray-600 space-y-1">
              <li>1. Open Instagram</li>
              <li>2. Find a post you want to save</li>
              <li>3. Tap "Share" → "Send in Direct"</li>
              <li>4. Search for @urdigest and send</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition">
              {post.thumbnail_url && (
                <img
                  src={post.thumbnail_url}
                  alt={post.caption || 'Instagram post'}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4">
                {post.author_username && (
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    @{post.author_username}
                  </p>
                )}
                {post.caption && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                    {post.caption}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span>{new Date(post.saved_at).toLocaleDateString()}</span>
                  {post.processed && <span className="text-green-600">✓ In digest</span>}
                </div>
                <div className="flex gap-2">
                  <a
                    href={post.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm font-medium hover:bg-gray-200 transition"
                  >
                    View Post
                  </a>
                  <button
                    onClick={() => deletePost(post.id)}
                    className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm font-medium hover:bg-red-100 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
