'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface UserRow {
  id: string
  email: string
  created_at: string
  subscription_status: string
  total_posts_saved: number
  total_digests_sent: number
  digest_enabled: boolean
  instagram_username: string | null
  last_post_received_at: string | null
  trial_digest_sent: boolean
}

interface DigestRow {
  id: string
  user_id: string
  subject: string | null
  post_count: number
  sent_at: string
  opened_at: string | null
}

interface Stats {
  totalUsers: number
  activeSubscriptions: number
  trialUsers: number
  totalPosts: number
  totalDigests: number
  users: UserRow[]
  recentDigests: DigestRow[]
}

export default function AdminDashboard() {
  const searchParams = useSearchParams()
  const secret = searchParams.get('secret')
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!secret) {
      setError('Missing secret parameter')
      setLoading(false)
      return
    }

    fetch(`/api/admin/stats?secret=${encodeURIComponent(secret)}`)
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized')
        return res.json()
      })
      .then(data => setStats(data))
      .catch(() => setError('Unauthorized or failed to load'))
      .finally(() => setLoading(false))
  }, [secret])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-red-400">{error || 'Failed to load'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-8">Admin Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {[
          { label: 'Total Users', value: stats.totalUsers },
          { label: 'Active Subs', value: stats.activeSubscriptions },
          { label: 'Trial Users', value: stats.trialUsers },
          { label: 'Total Posts', value: stats.totalPosts },
          { label: 'Total Digests', value: stats.totalDigests },
        ].map(card => (
          <div key={card.label} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <h2 className="text-lg font-semibold mb-3">Users</h2>
      <div className="overflow-x-auto mb-10">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4">Instagram</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Posts</th>
              <th className="pb-2 pr-4">Digests</th>
              <th className="pb-2 pr-4">Enabled</th>
              <th className="pb-2 pr-4">Signed Up</th>
            </tr>
          </thead>
          <tbody>
            {stats.users.map(user => (
              <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="py-2 pr-4">{user.email}</td>
                <td className="py-2 pr-4 text-gray-400">{user.instagram_username || '-'}</td>
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    user.subscription_status === 'active' ? 'bg-green-900 text-green-300' :
                    user.subscription_status === 'trial' ? 'bg-yellow-900 text-yellow-300' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {user.subscription_status}
                  </span>
                </td>
                <td className="py-2 pr-4">{user.total_posts_saved}</td>
                <td className="py-2 pr-4">{user.total_digests_sent}</td>
                <td className="py-2 pr-4">{user.digest_enabled ? 'Yes' : 'No'}</td>
                <td className="py-2 pr-4 text-gray-400">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Digests */}
      <h2 className="text-lg font-semibold mb-3">Recent Digests</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="pb-2 pr-4">Subject</th>
              <th className="pb-2 pr-4">Posts</th>
              <th className="pb-2 pr-4">Sent</th>
              <th className="pb-2 pr-4">Opened</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentDigests.map(digest => (
              <tr key={digest.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="py-2 pr-4">{digest.subject || '(no subject)'}</td>
                <td className="py-2 pr-4">{digest.post_count}</td>
                <td className="py-2 pr-4 text-gray-400">
                  {new Date(digest.sent_at).toLocaleString()}
                </td>
                <td className="py-2 pr-4">
                  {digest.opened_at ? new Date(digest.opened_at).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
