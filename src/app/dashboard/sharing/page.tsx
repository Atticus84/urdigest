'use client'

import { useEffect, useState, useCallback } from 'react'
import type { DigestFollower } from '@/types/database'

interface SharingSettings {
  digest_name: string | null
  digest_description: string | null
  follow_slug: string | null
  sharing_enabled: boolean
  follower_count: number
  instagram_username: string | null
}

interface InstagramContact {
  id: string
  username: string
}

export default function SharingPage() {
  // Sharing settings
  const [settings, setSettings] = useState<SharingSettings | null>(null)
  const [digestName, setDigestName] = useState('')
  const [digestDescription, setDigestDescription] = useState('')
  const [followSlug, setFollowSlug] = useState('')
  const [sharingEnabled, setSharingEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')

  // Followers
  const [followers, setFollowers] = useState<DigestFollower[]>([])
  const [loadingFollowers, setLoadingFollowers] = useState(true)

  // Add followers modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [newEmails, setNewEmails] = useState('')
  const [shareNote, setShareNote] = useState('')
  const [addingFollowers, setAddingFollowers] = useState(false)
  const [addMessage, setAddMessage] = useState('')

  // Instagram
  const [igConnected, setIgConnected] = useState(false)
  const [igUsername, setIgUsername] = useState('')
  const [igContacts, setIgContacts] = useState<InstagramContact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [loadingIg, setLoadingIg] = useState(true)
  const [sendingDms, setSendingDms] = useState(false)
  const [dmMessage, setDmMessage] = useState('')

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    await Promise.all([loadSettings(), loadFollowers(), loadInstagram()])
    setLoading(false)
  }

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/user/sharing')
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
        setDigestName(data.digest_name || '')
        setDigestDescription(data.digest_description || '')
        setFollowSlug(data.follow_slug || '')
        setSharingEnabled(data.sharing_enabled || false)
      }
    } catch {}
  }

  const loadFollowers = async () => {
    try {
      const res = await fetch('/api/followers')
      if (res.ok) {
        const data = await res.json()
        setFollowers(data.followers || [])
      }
    } catch {}
    setLoadingFollowers(false)
  }

  const loadInstagram = async () => {
    try {
      const res = await fetch('/api/instagram/connections')
      if (res.ok) {
        const data = await res.json()
        setIgConnected(data.connected || false)
        setIgUsername(data.username || '')
        setIgContacts(data.contacts || [])
      }
    } catch {}
    setLoadingIg(false)
  }

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSettingsMessage('')

    try {
      const res = await fetch('/api/user/sharing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharing_enabled: sharingEnabled,
          digest_name: digestName || null,
          digest_description: digestDescription || null,
          follow_slug: followSlug || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      const updated = await res.json()
      setSettings(prev => prev ? { ...prev, ...updated } : prev)
      setSharingEnabled(updated.sharing_enabled)
      setDigestName(updated.digest_name || '')
      setDigestDescription(updated.digest_description || '')
      setFollowSlug(updated.follow_slug || '')
      setSettingsMessage('Saved.')
      setTimeout(() => setSettingsMessage(''), 3000)
    } catch (error: any) {
      setSettingsMessage(error.message || 'Failed to save')
    }

    setSaving(false)
  }

  const addFollowers = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingFollowers(true)
    setAddMessage('')

    const emails = newEmails
      .split(/[,\n]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0)

    if (emails.length === 0) {
      setAddMessage('Enter at least one email.')
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
      if (data.added?.length > 0) msgs.push(`Invited ${data.added.length}.`)
      if (data.skipped?.length > 0) msgs.push(`${data.skipped.length} already added.`)
      setAddMessage(msgs.join(' '))

      setNewEmails('')
      setShareNote('')
      setShowAddModal(false)
      loadFollowers()
      setTimeout(() => setAddMessage(''), 5000)
    } catch (error: any) {
      setAddMessage(error.message || 'Failed to add followers')
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
      setSettingsMessage('Link copied!')
      setTimeout(() => setSettingsMessage(''), 2000)
    }
  }, [followSlug])

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllContacts = () => {
    if (selectedContacts.size === igContacts.length) {
      setSelectedContacts(new Set())
    } else {
      setSelectedContacts(new Set(igContacts.map(c => c.id)))
    }
  }

  const sendDmInvites = async () => {
    if (selectedContacts.size === 0) return
    setSendingDms(true)
    setDmMessage('')

    try {
      const res = await fetch('/api/instagram/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientIds: Array.from(selectedContacts) }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }

      const data = await res.json()
      const msgs: string[] = []
      if (data.sent?.length > 0) msgs.push(`Sent ${data.sent.length} DM${data.sent.length > 1 ? 's' : ''}.`)
      if (data.failed?.length > 0) msgs.push(`${data.failed.length} failed.`)
      setDmMessage(msgs.join(' '))
      setSelectedContacts(new Set())
      setTimeout(() => setDmMessage(''), 5000)
    } catch (error: any) {
      setDmMessage(error.message || 'Failed to send DMs')
    }

    setSendingDms(false)
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-instagram-pink mx-auto mb-4"></div>
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  const confirmedCount = followers.filter(f => f.confirmed).length
  const pendingCount = followers.length - confirmedCount

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Share Your Digest</h1>
      <p className="text-gray-400 text-sm mb-10">
        Let others follow your digest. They'll get it in their inbox whenever you get yours.
      </p>

      {/* Follow Link Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <form onSubmit={saveSettings} className="space-y-5">
          {/* Sharing toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Enable follow page</p>
              <p className="text-xs text-gray-400 mt-0.5">Anyone with the link can subscribe</p>
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

          {/* Digest name */}
          <div>
            <label className="text-sm font-medium text-gray-900 mb-1 block">Digest name</label>
            <input
              type="text"
              value={digestName}
              onChange={(e) => setDigestName(e.target.value)}
              placeholder={settings?.instagram_username ? `@${settings.instagram_username}'s Digest` : "e.g. Ben's AI Digest"}
              maxLength={100}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-900 mb-1 block">Description</label>
            <textarea
              value={digestDescription}
              onChange={(e) => setDigestDescription(e.target.value)}
              placeholder="What's this digest about?"
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition resize-none"
            />
          </div>

          {/* Follow slug */}
          <div>
            <label className="text-sm font-medium text-gray-900 mb-1 block">Follow page URL</label>
            <div className="flex items-center gap-0">
              <span className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg shrink-0">
                urdigest.com/f/
              </span>
              <input
                type="text"
                value={followSlug}
                onChange={(e) => setFollowSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="your-digest-name"
                maxLength={60}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-r-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition"
              />
            </div>
          </div>

          {/* Copy link + Save */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-instagram-pink text-white rounded-lg text-sm font-medium hover:bg-instagram-pink/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {followSlug && sharingEnabled && (
              <button
                type="button"
                onClick={copyFollowLink}
                className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Copy follow link
              </button>
            )}
            {settingsMessage && (
              <span className={`text-sm ${
                settingsMessage.includes('Failed') || settingsMessage.includes('taken')
                  ? 'text-red-600' : 'text-instagram-purple'
              }`}>
                {settingsMessage}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Instagram DM Invites */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Invite via Instagram DM</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {igConnected
                ? `Connected as @${igUsername}`
                : 'Connect Instagram to invite people via DM'}
            </p>
          </div>
        </div>

        {!igConnected ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-2">
              Your Instagram account isn't connected yet.
            </p>
            <p className="text-xs text-gray-300">
              DM @urdigest on Instagram to connect your account, then come back here.
            </p>
          </div>
        ) : igContacts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-2">
              No recent conversations found.
            </p>
            <p className="text-xs text-gray-300">
              People who have DM'd @urdigest will appear here as invitable contacts.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={selectAllContacts}
                className="text-xs text-instagram-pink font-medium hover:underline"
              >
                {selectedContacts.size === igContacts.length ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-xs text-gray-400">
                {selectedContacts.size} selected
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
              {igContacts.map((contact) => (
                <label
                  key={contact.id}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedContacts.has(contact.id)}
                    onChange={() => toggleContact(contact.id)}
                    className="rounded border-gray-300 text-instagram-pink focus:ring-instagram-pink"
                  />
                  <span className="text-sm text-gray-900">@{contact.username}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={sendDmInvites}
                disabled={selectedContacts.size === 0 || sendingDms}
                className="px-6 py-2.5 bg-gradient-to-r from-instagram-pink to-instagram-purple text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingDms
                  ? 'Sending...'
                  : `Send DM invite${selectedContacts.size !== 1 ? 's' : ''}`}
              </button>
              {dmMessage && (
                <span className={`text-sm ${
                  dmMessage.includes('failed') ? 'text-red-600' : 'text-instagram-purple'
                }`}>
                  {dmMessage}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Followers List */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Followers</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {confirmedCount} confirmed{pendingCount > 0 ? `, ${pendingCount} pending` : ''}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-1.5 text-sm font-medium text-instagram-pink border border-instagram-pink rounded-lg hover:bg-instagram-pink/5 transition"
          >
            Add by email
          </button>
        </div>

        {addMessage && (
          <div className="text-sm text-instagram-purple mb-3">{addMessage}</div>
        )}

        {loadingFollowers ? (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-instagram-pink mx-auto"></div>
          </div>
        ) : followers.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            No followers yet. Invite people via email or Instagram DM above.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {followers.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-gray-900">{f.email}</p>
                  <p className="text-xs text-gray-400">
                    <span className={f.confirmed ? 'text-green-600' : 'text-amber-500'}>
                      {f.confirmed ? 'Confirmed' : 'Pending'}
                    </span>
                    {' '}&middot; via {f.source}
                  </p>
                </div>
                <button
                  onClick={() => removeFollower(f.id)}
                  className="text-xs text-gray-400 hover:text-red-500 transition px-2 py-1"
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
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Add followers by email</h3>
            <p className="text-sm text-gray-400 mb-6">
              They'll get a confirmation email before receiving your digests.
            </p>

            <form onSubmit={addFollowers} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-900 mb-1 block">
                  Email addresses
                </label>
                <textarea
                  value={newEmails}
                  onChange={(e) => setNewEmails(e.target.value)}
                  placeholder={"friend@example.com\nanother@example.com"}
                  rows={4}
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition resize-none"
                />
                <p className="text-xs text-gray-300 mt-1">Separate with commas or new lines</p>
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
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition"
                />
              </div>

              <div className="flex gap-3 pt-2">
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
