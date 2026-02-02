'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import type { User } from '@/types/database'

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
]

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [digestTime, setDigestTime] = useState('06:00:00')
  const [timezone, setTimezone] = useState('America/New_York')
  const [digestEnabled, setDigestEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const supabase = createClient()
    const { data: authUser } = await supabase.auth.getUser()

    if (authUser.user) {
      const userData = await ensureUserProfile(supabase, authUser.user.id, authUser.user.email!)

      if (userData) {
        setUser(userData)
        setDigestTime(userData.digest_time)
        setTimezone(userData.timezone)
        setDigestEnabled(userData.digest_enabled)
      }
    }

    setLoading(false)
  }

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digest_time: digestTime,
          timezone,
          digest_enabled: digestEnabled,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      const updatedUser = await response.json()
      setUser(updatedUser)
      setMessage('Settings saved.')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Failed to save settings')
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-400 text-sm">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Settings</h1>
      <p className="text-gray-400 text-sm mb-10">Manage your digest preferences</p>

      <form onSubmit={saveSettings} className="space-y-8">
        {/* Digest Preferences */}
        <section>
          <h2 className="text-sm font-medium text-gray-900 uppercase tracking-wide mb-6">
            Digest Preferences
          </h2>

          {/* Digest Enabled */}
          <div className="flex items-center justify-between py-4 border-b border-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">Daily Digests</p>
              <p className="text-xs text-gray-400 mt-0.5">Receive email digests on schedule</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={digestEnabled}
                onChange={(e) => setDigestEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
            </label>
          </div>

          {/* Digest Time */}
          <div className="py-4 border-b border-gray-50">
            <p className="text-sm font-medium text-gray-900 mb-1">Send time</p>
            <p className="text-xs text-gray-400 mb-3">When should we send your digest?</p>
            <input
              type="time"
              value={digestTime.substring(0, 5)}
              onChange={(e) => setDigestTime(e.target.value + ':00')}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
            />
          </div>

          {/* Timezone */}
          <div className="py-4">
            <p className="text-sm font-medium text-gray-900 mb-1">Timezone</p>
            <p className="text-xs text-gray-400 mb-3">Your local timezone</p>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Email */}
        <section>
          <h2 className="text-sm font-medium text-gray-900 uppercase tracking-wide mb-6">
            Email
          </h2>
          <div className="py-4 border-b border-gray-50">
            <p className="text-sm font-medium text-gray-900 mb-1">Email address</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </section>

        {/* Status Message */}
        {message && (
          <div className={`text-sm ${
            message.includes('Failed') ? 'text-red-600' : 'text-gray-500'
          }`}>
            {message}
          </div>
        )}

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
