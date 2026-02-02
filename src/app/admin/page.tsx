'use client'

import { Suspense, useEffect, useState } from 'react'
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
  posts_last_7d: number
  digests_opened: number
  days_since_signup: number
  activation_status: string
  last_activity: string
}

interface DigestRow {
  id: string
  user_id: string
  subject: string | null
  post_count: number
  sent_at: string
  opened_at: string | null
}

interface Funnel {
  signups: number
  connectedIG: number
  sentFirstPost: number
  receivedFirstDigest: number
  openedDigest: number
  sentSecondPost: number
}

interface Stats {
  newUsersLast7: number
  activatedUsers: number
  activatedWithDigest: number
  trialToPaidPct: number
  avgPostsPerActiveUser: string
  digestsLast7: number
  secondPostAfterDigestPct: number
  funnel: Funnel
  digestPerformance: {
    totalSent: number
    totalOpened: number
    openRate: number
  }
  users: UserRow[]
  recentDigests: DigestRow[]
  alerts: string[]
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <AdminDashboard />
    </Suspense>
  )
}

const STATUS_STYLES: Record<string, string> = {
  signed_up: 'bg-gray-800 text-gray-400',
  activated: 'bg-blue-900 text-blue-300',
  habit_forming: 'bg-green-900 text-green-300',
  at_risk: 'bg-orange-900 text-orange-300',
  churned: 'bg-red-900 text-red-300',
}

const STATUS_LABELS: Record<string, string> = {
  signed_up: 'Signed Up',
  activated: 'Activated',
  habit_forming: 'Habit Forming',
  at_risk: 'At Risk',
  churned: 'Churned',
}

function AdminDashboard() {
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

  const funnelSteps = [
    { label: 'Signups', value: stats.funnel.signups },
    { label: 'Connected IG', value: stats.funnel.connectedIG },
    { label: 'Sent 1st post', value: stats.funnel.sentFirstPost },
    { label: 'Received digest', value: stats.funnel.receivedFirstDigest },
    { label: 'Opened digest', value: stats.funnel.openedDigest },
    { label: 'Sent 2nd post', value: stats.funnel.sentSecondPost },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Activation & retention operator console</p>

      {/* Alerts */}
      {stats.alerts.length > 0 && (
        <div className="mb-8 bg-yellow-950 border border-yellow-800 rounded-lg p-4">
          <h2 className="text-yellow-300 font-semibold text-sm mb-2">Needs Attention</h2>
          <ul className="space-y-1">
            {stats.alerts.map((alert, i) => (
              <li key={i} className="text-yellow-200 text-sm">{alert}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Key Activation Metric */}
      <div className="mb-8 bg-indigo-950 border border-indigo-800 rounded-lg p-4">
        <p className="text-indigo-300 text-sm font-medium">Key Metric: 2nd post after 1st digest</p>
        <p className="text-3xl font-bold mt-1">{stats.secondPostAfterDigestPct}%</p>
        <p className="text-indigo-400 text-xs mt-1">% of users who sent a second post after receiving their first digest</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {[
          { label: 'New users (7d)', value: stats.newUsersLast7 },
          { label: 'Activated users', value: stats.activatedUsers },
          { label: 'Activated + Digest', value: stats.activatedWithDigest },
          { label: 'Trial \u2192 Paid %', value: `${stats.trialToPaidPct}%` },
          { label: 'Avg posts / active user', value: stats.avgPostsPerActiveUser },
          { label: 'Digests sent (7d)', value: stats.digestsLast7 },
        ].map(card => (
          <div key={card.label} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-gray-400 text-xs">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Funnel View */}
      <h2 className="text-lg font-semibold mb-3">Activation Funnel</h2>
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-10">
        <div className="space-y-2">
          {funnelSteps.map((step, i) => {
            const pct = stats.funnel.signups > 0 ? (step.value / stats.funnel.signups) * 100 : 0
            const prevValue = i > 0 ? funnelSteps[i - 1].value : step.value
            const dropoff = prevValue > 0 ? Math.round(((prevValue - step.value) / prevValue) * 100) : 0
            return (
              <div key={step.label} className="flex items-center gap-3">
                <span className="text-gray-400 text-sm w-32 shrink-0">{step.label}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className="text-white text-sm font-mono w-8 text-right">{step.value}</span>
                {i > 0 && dropoff > 0 && (
                  <span className="text-red-400 text-xs w-12 text-right">-{dropoff}%</span>
                )}
                {i === 0 && <span className="w-12" />}
              </div>
            )
          })}
        </div>
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
              <th className="pb-2 pr-4">Activation</th>
              <th className="pb-2 pr-4">Posts (7d)</th>
              <th className="pb-2 pr-4">Posts (all)</th>
              <th className="pb-2 pr-4">Digests</th>
              <th className="pb-2 pr-4">Opened</th>
              <th className="pb-2 pr-4">Days</th>
              <th className="pb-2 pr-4">Last Activity</th>
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
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_STYLES[user.activation_status] || 'bg-gray-800 text-gray-400'}`}>
                    {STATUS_LABELS[user.activation_status] || user.activation_status}
                  </span>
                </td>
                <td className="py-2 pr-4">{user.posts_last_7d}</td>
                <td className="py-2 pr-4">{user.total_posts_saved}</td>
                <td className="py-2 pr-4">{user.total_digests_sent}</td>
                <td className="py-2 pr-4">{user.digests_opened}</td>
                <td className="py-2 pr-4 text-gray-400">{user.days_since_signup}d</td>
                <td className="py-2 pr-4 text-gray-400">
                  {new Date(user.last_activity).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Digest Performance */}
      <h2 className="text-lg font-semibold mb-3">Digest Performance</h2>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <p className="text-gray-400 text-xs">Total Sent</p>
          <p className="text-2xl font-bold mt-1">{stats.digestPerformance.totalSent}</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <p className="text-gray-400 text-xs">Total Opened</p>
          <p className="text-2xl font-bold mt-1">{stats.digestPerformance.totalOpened}</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <p className="text-gray-400 text-xs">Open Rate</p>
          <p className="text-2xl font-bold mt-1">{stats.digestPerformance.openRate}%</p>
        </div>
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
                  {digest.opened_at ? (
                    <span className="text-green-400">{new Date(digest.opened_at).toLocaleString()}</span>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
