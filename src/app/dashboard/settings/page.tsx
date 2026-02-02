'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import type { User, DigestFollower } from '@/types/database'

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

  // Sharing state
  const [sharingEnabled, setSharingEnabled] = useState(false)
  const [digestName, setDigestName] = useState('')
  const [digestDescription, setDigestDescription] = useState('')
  const [followSlug, setFollowSlug] = useState('')
  const [savingSharing, setSavingSharing] = useState(false)
  const [sharingMessage, setSharingMessage] = useState('')

  // Followers state
  const [followers, setFollowers] = useState<DigestFollower[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newEmails, setNewEmails] = useState('')
  const [shareNote, setShareNote] = useState('')
  const [addingFollowers, setAddingFollowers] = useState(false)
  const [followerMessage, setFollowerMessage] = useState('')

  useEffect(() => {
    loadSettings()
    loadFollowers()
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
        setSharingEnabled(userData.sharing_enabled || false)
        setDigestName(userData.digest_name || '')
        setDigestDescription(userData.digest_description || '')
        setFollowSlug(userData.follow_slug || '')
      }
    }

    setLoading(false)
  }

  const loadFollowers = async () => {
    try {
      const res = await fetch('/api/followers')
      if (res.ok) {
        const data = await res.json()
        setFollowers(data.followers || [])
      }
    } catch {}
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

  const saveSharingSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSharing(true)
    setSharingMessage('')

    try {
      const body: Record<string, any> = { sharing_enabled: sharingEnabled }
      if (digestName) body.digest_name = digestName
      if (digestDescription) body.digest_description = digestDescription
      if (followSlug) body.follow_slug = followSlug

      const res = await fetch('/api/user/sharing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      const updated = await res.json()
      setSharingEnabled(updated.sharing_enabled)
      setDigestName(updated.digest_name || '')
      setDigestDescription(updated.digest_description || '')
      setFollowSlug(updated.follow_slug || '')
      setSharingMessage('Sharing settings saved.')
      setTimeout(() => setSharingMessage(''), 3000)
    } catch (error: any) {
      setSharingMessage(error.message || 'Failed to save')
    }

    setSavingSharing(false)
  }

  const addFollowers = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingFollowers(true)
    setFollowerMessage('')

    const emails = newEmails
      .split(/[,\n]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0)

    if (emails.length === 0) {
      setFollowerMessage('Enter at least one email.')
      setAddingFollowers(false)
      return
    }

    try {
      const res = await fetch('/api/followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, note: shareNote || undefined }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add')
      }

      const data = await res.json()
      const msgs: string[] = []
      if (data.added.length > 0) msgs.push(`Invited ${data.added.length} email${data.added.length > 1 ? 's' : ''}.`)
      if (data.skipped.length > 0) msgs.push(`${data.skipped.length} already added.`)
      setFollowerMessage(msgs.join(' '))

      setNewEmails('')
      setShareNote('')
      setShowAddModal(false)
      loadFollowers()
      setTimeout(() => setFollowerMessage(''), 5000)
    } catch (error: any) {
      setFollowerMessage(error.message || 'Failed to add followers')
    }

    setAddingFollowers(false)
  }

  const removeFollower = async (id: string) => {
    try {
      await fetch(`/api/followers?id=${id}`, { method: 'DELETE' })
      setFollowers(prev => prev.filter(f => f.id !== id))
    } catch {}
  }

  const copyFollowLink = useCallback(() => {
    if (followSlug) {
      navigator.clipboard.writeText(`${window.location.origin}/f/${followSlug}`)
      setSharingMessage('Link copied!')
      setTimeout(() => setSharingMessage(''), 2000)
    }
  }, [followSlug])

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-instagram-pink mx-auto mb-4"></div>
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
          <h2 className="text-sm font-medium text-instagram-purple uppercase tracking-wide mb-6">
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
              <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-instagram-pink"></div>
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
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition"
            />
          </div>

          {/* Timezone */}
          <div className="py-4">
            <p className="text-sm font-medium text-gray-900 mb-1">Timezone</p>
            <p className="text-xs text-gray-400 mb-3">Your local timezone</p>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition"
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
          <h2 className="text-sm font-medium text-instagram-purple uppercase tracking-wide mb-6">
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
            message.includes('Failed') ? 'text-red-600' : 'text-instagram-purple'
          }`}>
            {message}
          </div>
        )}

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-instagram-pink text-white py-2.5 rounded-lg text-sm font-medium hover:bg-instagram-pink/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {/* Sharing Section */}
      <div id="sharing" className="mt-16 pt-8 border-t border-gray-100">
        <h2 className="text-sm font-medium text-instagram-purple uppercase tracking-wide mb-6">
          Share Your Digest
        </h2>
        <p className="text-xs text-gray-400 mb-6">
          Let others follow your digest. They'll receive it in their inbox whenever you get yours.
        </p>

        <form onSubmit={saveSharingSettings} className="space-y-5">
          {/* Sharing Enabled */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Enable sharing</p>
              <p className="text-xs text-gray-400 mt-0.5">Make your follow page public</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={sharingEnabled}
                onChange={(e) => setSharingEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-instagram-pink"></div>
            </label>
          </div>

          {/* Digest Name */}
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Digest name</p>
            <input
              type="text"
              value={digestName}
              onChange={(e) => setDigestName(e.target.value)}
              placeholder="e.g. Ben's AI Digest"
              maxLength={100}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition"
            />
          </div>

          {/* Description */}
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Description</p>
            <textarea
              value={digestDescription}
              onChange={(e) => setDigestDescription(e.target.value)}
              placeholder="What's this digest about?"
              maxLength={500}
              rows={2}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition resize-none"
            />
          </div>

          {/* Follow Slug */}
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Follow page URL</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 shrink-0">urdigest.com/f/</span>
              <input
                type="text"
                value={followSlug}
                onChange={(e) => setFollowSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="your-digest-name"
                maxLength={60}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition"
              />
            </div>
          </div>

          {/* Follow link copy button */}
          {followSlug && sharingEnabled && (
            <button
              type="button"
              onClick={copyFollowLink}
              className="text-sm text-instagram-pink font-medium hover:underline"
            >
              Copy follow link
            </button>
          )}

          {sharingMessage && (
            <div className={`text-sm ${
              sharingMessage.includes('Failed') || sharingMessage.includes('taken')
                ? 'text-red-600' : 'text-instagram-purple'
            }`}>
              {sharingMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={savingSharing}
            className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingSharing ? 'Saving...' : 'Save Sharing Settings'}
          </button>
        </form>
      </div>

      {/* Followers Section */}
      <div className="mt-16 pt-8 border-t border-gray-100 mb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-medium text-instagram-purple uppercase tracking-wide">
              Followers
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {followers.length} {followers.length === 1 ? 'follower' : 'followers'}
              {followers.filter(f => f.confirmed).length < followers.length && (
                <span> ({followers.filter(f => f.confirmed).length} confirmed)</span>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-1.5 text-sm font-medium text-instagram-pink border border-instagram-pink rounded-lg hover:bg-instagram-pink/5 transition"
          >
            Add followers
          </button>
        </div>

        {followerMessage && (
          <div className="text-sm text-instagram-purple mb-4">{followerMessage}</div>
        )}

        {followers.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            No followers yet. Invite people to follow your digest.
          </div>
        ) : (
          <div className="space-y-0">
            {followers.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-3 border-b border-gray-50">
                <div>
                  <p className="text-sm text-gray-900">{f.email}</p>
                  <p className="text-xs text-gray-400">
                    {f.confirmed ? 'Confirmed' : 'Pending confirmation'} &middot; via {f.source}
                  </p>
                </div>
                <button
                  onClick={() => removeFollower(f.id)}
                  className="text-xs text-gray-400 hover:text-red-500 transition"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Followers Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Add followers</h3>
            <p className="text-sm text-gray-400 mb-6">
              They'll receive a confirmation email before getting your digests.
            </p>

            <form onSubmit={addFollowers} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-900 mb-1 block">
                  Email addresses
                </label>
                <textarea
                  value={newEmails}
                  onChange={(e) => setNewEmails(e.target.value)}
                  placeholder="Enter emails separated by commas or new lines"
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-900 mb-1 block">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  placeholder="Why you're sharing this"
                  maxLength={500}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingFollowers}
                  className="flex-1 bg-instagram-pink text-white py-2.5 rounded-lg text-sm font-medium hover:bg-instagram-pink/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingFollowers ? 'Sending...' : 'Send invites'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
