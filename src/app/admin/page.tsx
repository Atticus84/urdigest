'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface StatusData {
  instagram_token: {
    status: string
    error_code?: number
    error_message?: string
    error_type?: string
    page_id?: string
    page_name?: string
    token_prefix?: string
    token_length?: number
    message?: string
  }
  env_vars: Record<string, boolean | string>
  users: {
    total: number
    by_onboarding_state: Record<string, number>
    by_subscription: Record<string, number>
    digest_enabled_count: number
    list: Array<{
      id: string
      email: string
      instagram_username: string | null
      instagram_user_id: string | null
      onboarding_state: string
      digest_enabled: boolean
      subscription_status: string
      total_posts_saved: number
      total_digests_sent: number
      last_post_received_at: string | null
      digest_time: string
      timezone: string
      created_at: string
    }>
    error?: string
  }
  recent_posts: {
    total: number
    unprocessed: number
    latest_20: Array<{
      id: string
      user_id: string
      instagram_url: string
      processed: boolean
      saved_at: string
      created_at: string
    }>
    error?: string
  }
  recent_digests: {
    total: number
    latest_10: Array<{
      id: string
      user_id: string
      subject: string
      post_count: number
      sent_at: string
      opened_at: string | null
    }>
    error?: string
  }
  checked_at: string
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    valid: 'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
    error: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.toUpperCase()}
    </span>
  )
}

function EnvBadge({ configured }: { configured: boolean | string }) {
  if (typeof configured === 'string') {
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{configured}</span>
  }
  return configured ? (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">SET</span>
  ) : (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">MISSING</span>
  )
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function AdminDashboard() {
  const searchParams = useSearchParams()
  const secret = searchParams.get('secret')
  const [data, setData] = useState<StatusData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/status?secret=${secret}`)
      if (!res.ok) {
        if (res.status === 401) {
          setError('Unauthorized. Add ?secret=YOUR_ADMIN_SECRET to the URL.')
          setLoading(false)
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
      setLastRefresh(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (secret) fetchStatus()
    else {
      setError('Add ?secret=YOUR_ADMIN_SECRET to the URL.')
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-900/50 border border-red-700 text-red-200 p-6 rounded-lg max-w-md">
          <h2 className="text-lg font-bold mb-2">Access Denied</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading admin dashboard...</div>
      </div>
    )
  }

  if (!data) return null

  const tokenOk = data.instagram_token.status === 'valid'

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">urdigest Admin Dashboard</h1>
            <p className="text-gray-400 text-sm">
              Last checked: {lastRefresh?.toLocaleTimeString() || 'Never'}
            </p>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 px-4 py-2 rounded-lg text-sm font-medium"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Critical Alert */}
        {!tokenOk && (
          <div className="bg-red-900/50 border border-red-700 p-4 rounded-lg mb-6">
            <h3 className="text-red-300 font-bold text-lg mb-1">Instagram Token Issue</h3>
            <p className="text-red-200">
              {data.instagram_token.status === 'expired'
                ? `Token is expired or invalid. Error ${data.instagram_token.error_code}: ${data.instagram_token.error_message}`
                : data.instagram_token.message || 'Token check failed'}
            </p>
            <p className="text-red-300 text-sm mt-2">
              This means confirmation messages and all DM replies are NOT being sent.
              Generate a new Page Access Token in Meta Business Suite and update INSTAGRAM_ACCESS_TOKEN.
            </p>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Instagram Token</div>
            <div className="mt-1"><StatusBadge status={data.instagram_token.status} /></div>
            {data.instagram_token.page_name && (
              <div className="text-gray-400 text-xs mt-1">Page: {data.instagram_token.page_name}</div>
            )}
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Users</div>
            <div className="text-2xl font-bold">{data.users.total}</div>
            <div className="text-gray-400 text-xs">{data.users.digest_enabled_count} with digests on</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Posts</div>
            <div className="text-2xl font-bold">{data.recent_posts.total}</div>
            <div className="text-gray-400 text-xs">{data.recent_posts.unprocessed} unprocessed</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Digests Sent</div>
            <div className="text-2xl font-bold">{data.recent_digests.total}</div>
          </div>
        </div>

        {/* Messaging Disabled Warning */}
        {data.env_vars.INSTAGRAM_DISABLE_MESSAGES === 'true' && (
          <div className="bg-yellow-900/50 border border-yellow-700 p-4 rounded-lg mb-6">
            <h3 className="text-yellow-300 font-bold">Messaging Disabled</h3>
            <p className="text-yellow-200 text-sm">
              INSTAGRAM_DISABLE_MESSAGES is set to true. No DM replies are being sent.
            </p>
          </div>
        )}

        {/* Environment Variables */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Environment Variables</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(data.env_vars).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between bg-gray-700/50 rounded px-3 py-2">
                <code className="text-sm text-gray-300">{key}</code>
                <EnvBadge configured={value} />
              </div>
            ))}
          </div>
        </div>

        {/* Users by State */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">Onboarding State</h2>
            {Object.entries(data.users.by_onboarding_state).map(([state, count]) => (
              <div key={state} className="flex justify-between py-2 border-b border-gray-700 last:border-0">
                <span className="text-gray-300">{state}</span>
                <span className="font-mono font-bold">{count}</span>
              </div>
            ))}
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">Subscription Status</h2>
            {Object.entries(data.users.by_subscription).map(([status, count]) => (
              <div key={status} className="flex justify-between py-2 border-b border-gray-700 last:border-0">
                <span className="text-gray-300">{status}</span>
                <span className="font-mono font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Users List */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">All Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-700">
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Instagram</th>
                  <th className="pb-2 pr-4">State</th>
                  <th className="pb-2 pr-4">Digest</th>
                  <th className="pb-2 pr-4">Posts</th>
                  <th className="pb-2 pr-4">Sent</th>
                  <th className="pb-2 pr-4">Last Post</th>
                  <th className="pb-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.users.list?.map((user) => (
                  <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-4">
                      <span className="text-gray-200">{user.email?.includes('placeholder') ? <span className="text-gray-500 italic">pending</span> : user.email}</span>
                    </td>
                    <td className="py-2 pr-4 text-gray-300">
                      {user.instagram_username ? `@${user.instagram_username}` : user.instagram_user_id || '-'}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        user.onboarding_state === 'onboarded' ? 'bg-green-900/50 text-green-300' :
                        user.onboarding_state === 'awaiting_email' ? 'bg-yellow-900/50 text-yellow-300' :
                        user.onboarding_state === 'awaiting_time' ? 'bg-blue-900/50 text-blue-300' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {user.onboarding_state || 'none'}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {user.digest_enabled ? (
                        <span className="text-green-400">{user.digest_time}</span>
                      ) : (
                        <span className="text-gray-500">off</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono">{user.total_posts_saved}</td>
                    <td className="py-2 pr-4 font-mono">{user.total_digests_sent}</td>
                    <td className="py-2 pr-4 text-gray-400">{timeAgo(user.last_post_received_at)}</td>
                    <td className="py-2 text-gray-400">{timeAgo(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Posts */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Recent Posts (Last 20)</h2>
          {data.recent_posts.latest_20?.length === 0 ? (
            <p className="text-gray-500">No posts yet</p>
          ) : (
            <div className="space-y-2">
              {data.recent_posts.latest_20?.map((post) => (
                <div key={post.id} className="flex items-center justify-between bg-gray-700/50 rounded px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${post.processed ? 'bg-green-400' : 'bg-yellow-400'}`} />
                    <a href={post.instagram_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm truncate max-w-md">
                      {post.instagram_url}
                    </a>
                  </div>
                  <span className="text-gray-400 text-xs">{timeAgo(post.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Digests */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4">Recent Digests (Last 10)</h2>
          {data.recent_digests.latest_10?.length === 0 ? (
            <p className="text-gray-500">No digests sent yet</p>
          ) : (
            <div className="space-y-2">
              {data.recent_digests.latest_10?.map((digest) => (
                <div key={digest.id} className="flex items-center justify-between bg-gray-700/50 rounded px-3 py-2">
                  <div>
                    <span className="text-gray-200 text-sm">{digest.subject || 'No subject'}</span>
                    <span className="text-gray-500 text-xs ml-2">({digest.post_count} posts)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {digest.opened_at && <span className="text-green-400 text-xs">Opened</span>}
                    <span className="text-gray-400 text-xs">{timeAgo(digest.sent_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
