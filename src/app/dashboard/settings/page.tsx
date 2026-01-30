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
      setMessage('Settings saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Failed to save settings')
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-instagram-pink mx-auto mb-4"></div>
        <p className="text-gray-600">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-600 mb-8">Manage your digest preferences</p>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form onSubmit={saveSettings} className="space-y-6">
          {/* Digest Enabled */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="font-semibold text-gray-900 block mb-1">
                Daily Digests
              </label>
              <p className="text-sm text-gray-600">
                Receive email digests every morning
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={digestEnabled}
                onChange={(e) => setDigestEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-instagram-pink/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-instagram-pink"></div>
            </label>
          </div>

          <hr />

          {/* Digest Time */}
          <div>
            <label className="font-semibold text-gray-900 block mb-2">
              Digest Time
            </label>
            <p className="text-sm text-gray-600 mb-3">
              What time should we send your daily digest?
            </p>
            <input
              type="time"
              value={digestTime.substring(0, 5)}
              onChange={(e) => setDigestTime(e.target.value + ':00')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-instagram-pink focus:border-transparent"
            />
          </div>

          {/* Timezone */}
          <div>
            <label className="font-semibold text-gray-900 block mb-2">
              Timezone
            </label>
            <p className="text-sm text-gray-600 mb-3">
              Your local timezone
            </p>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-instagram-pink focus:border-transparent"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Message */}
          {message && (
            <div className={`px-4 py-3 rounded-lg text-sm ${
              message.includes('Failed')
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}>
              {message}
            </div>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-instagram-pink text-white py-3 rounded-lg font-semibold hover:bg-instagram-pink/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
        <h2 className="font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Member since</span>
            <span className="font-medium">
              {new Date(user?.created_at!).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total posts saved</span>
            <span className="font-medium">{user?.total_posts_saved}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Digests sent</span>
            <span className="font-medium">{user?.total_digests_sent}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
