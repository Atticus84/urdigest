'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import type { User, DigestRecipient } from '@/types/database'

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
  const [recipients, setRecipients] = useState<DigestRecipient[]>([])
  const [newRecipientEmail, setNewRecipientEmail] = useState('')
  const [newRecipientName, setNewRecipientName] = useState('')
  const [addingRecipient, setAddingRecipient] = useState(false)
  const [recipientMessage, setRecipientMessage] = useState('')
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

    // Load recipients
    await loadRecipients()

    setLoading(false)
  }

  const loadRecipients = async () => {
    try {
      const response = await fetch('/api/user/recipients')
      if (response.ok) {
        const data = await response.json()
        setRecipients(data.recipients || [])
      }
    } catch (error) {
      console.error('Failed to load recipients:', error)
    }
  }

  const addRecipient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRecipientEmail) return

    setAddingRecipient(true)
    setRecipientMessage('')

    try {
      const response = await fetch('/api/user/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newRecipientEmail,
          name: newRecipientName || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add recipient')
      }

      const data = await response.json()
      setRecipients([...recipients, data.recipient])
      setNewRecipientEmail('')
      setNewRecipientName('')
      setRecipientMessage('Recipient added!')
      setTimeout(() => setRecipientMessage(''), 3000)
    } catch (error: any) {
      setRecipientMessage(error.message || 'Failed to add recipient')
    }

    setAddingRecipient(false)
  }

  const removeRecipient = async (id: string) => {
    try {
      const response = await fetch(`/api/user/recipients?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setRecipients(recipients.filter(r => r.id !== id))
      }
    } catch (error) {
      console.error('Failed to remove recipient:', error)
    }
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

      {/* Digest Recipients */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
        <h2 className="font-semibold text-gray-900 mb-1">Digest Recipients</h2>
        <p className="text-sm text-gray-600 mb-4">
          Add email addresses to share your digest with friends and family. Your digest will be sent to all recipients below in addition to your own email.
        </p>

        {/* Current recipients */}
        {recipients.length > 0 && (
          <div className="space-y-2 mb-4">
            {recipients.map((recipient) => (
              <div key={recipient.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-gray-900">{recipient.email}</span>
                  {recipient.name && (
                    <span className="text-sm text-gray-500 ml-2">({recipient.name})</span>
                  )}
                </div>
                <button
                  onClick={() => removeRecipient(recipient.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add recipient form */}
        <form onSubmit={addRecipient} className="space-y-3">
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="friend@example.com"
              value={newRecipientEmail}
              onChange={(e) => setNewRecipientEmail(e.target.value)}
              required
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-instagram-pink focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Name (optional)"
              value={newRecipientName}
              onChange={(e) => setNewRecipientName(e.target.value)}
              className="w-40 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-instagram-pink focus:border-transparent"
            />
            <button
              type="submit"
              disabled={addingRecipient || !newRecipientEmail}
              className="bg-instagram-pink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-instagram-pink/90 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {addingRecipient ? 'Adding...' : 'Add'}
            </button>
          </div>
          {recipientMessage && (
            <div className={`px-4 py-2 rounded-lg text-sm ${
              recipientMessage.includes('added')
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {recipientMessage}
            </div>
          )}
        </form>

        <p className="text-xs text-gray-400 mt-3">
          Up to 10 recipients. All recipients will receive the same digest you do.
        </p>
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
