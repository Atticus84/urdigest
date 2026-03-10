'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns'
import type { Digest } from '@/types/database'

interface PendingPost {
  id: string
  post_type: string | null
  saved_at: string
  thumbnail_url: string | null
  author_username: string | null
  caption: string | null
}

export default function DigestsPage() {
  const [digests, setDigests] = useState<Digest[]>([])
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendMessage, setSendMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [digestsRes, pendingRes] = await Promise.all([
        fetch('/api/digests/list'),
        fetch('/api/digests/pending'),
      ])

      if (digestsRes.ok) {
        const data = await digestsRes.json()
        setDigests(data.digests || [])
      }
      if (pendingRes.ok) {
        const data = await pendingRes.json()
        setPendingPosts(data.posts || [])
      }
    } catch (err) {
      console.error('Failed to load digests:', err)
    }
    setLoading(false)
  }

  const handleSendNow = async () => {
    setSending(true)
    setSendMessage('')
    try {
      const res = await fetch('/api/digests/send', { method: 'POST' })
      if (res.ok) {
        setSendMessage('Digest is being generated and sent!')
        // Refresh after a short delay
        setTimeout(() => {
          loadData()
          setSendMessage('')
        }, 5000)
      } else {
        const data = await res.json()
        setSendMessage(data.error || 'Failed to send')
      }
    } catch {
      setSendMessage('Something went wrong')
    }
    setSending(false)
  }

  // Group digests by time period
  const grouped = groupDigests(digests)

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-instagram-pink mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Loading digests...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-0.5">Digests</h1>
        <p className="text-gray-400 text-xs md:text-sm">
          Your daily AI-summarized newsletters
        </p>
      </div>

      {/* Pending posts banner */}
      {pendingPosts.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 mb-0.5">
                {pendingPosts.length} post{pendingPosts.length !== 1 ? 's' : ''} queued for your next digest
              </p>
              <p className="text-xs text-gray-500">
                These will be compiled into your next scheduled digest, or you can send one now.
              </p>
            </div>
            <button
              onClick={handleSendNow}
              disabled={sending}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 active:bg-gray-700 transition disabled:opacity-50"
            >
              {sending ? (
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              Send now
            </button>
          </div>
          {sendMessage && (
            <p className={`text-xs mt-2 ${sendMessage.includes('!') ? 'text-green-600' : 'text-red-500'}`}>
              {sendMessage}
            </p>
          )}

          {/* Pending post chips */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {pendingPosts.slice(0, 8).map((post) => (
              <span
                key={post.id}
                className="inline-flex items-center gap-1 text-[10px] font-medium bg-white/80 text-gray-600 px-2 py-1 rounded-full border border-orange-100"
              >
                <span className="uppercase">{post.post_type || 'post'}</span>
                {post.author_username && <span className="text-gray-400">@{post.author_username}</span>}
              </span>
            ))}
            {pendingPosts.length > 8 && (
              <span className="text-[10px] text-gray-400 px-2 py-1">
                +{pendingPosts.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Digest list grouped by time */}
      {digests.length === 0 ? (
        <div className="text-center py-16 bg-gray-50/50 rounded-xl border border-gray-100">
          <span className="text-4xl mb-3 block">📬</span>
          <p className="text-gray-500 text-sm mb-1">No digests yet</p>
          <p className="text-gray-300 text-xs">Save some Instagram posts and your first digest will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.label}>
              <h2 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {group.label}
              </h2>
              <div className="space-y-2">
                {group.digests.map((digest) => {
                  const sentDate = new Date(digest.sent_at)
                  return (
                    <Link
                      key={digest.id}
                      href={`/dashboard/digests/${digest.id}`}
                      className="block bg-white border border-gray-100 rounded-xl p-4 active:bg-gray-50 transition group hover:border-gray-200"
                    >
                      <div className="flex items-start gap-3">
                        {/* Date circle */}
                        <div className="shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-full bg-gray-50 flex flex-col items-center justify-center border border-gray-100">
                          <span className="text-[10px] font-bold text-gray-900 leading-none">{format(sentDate, 'd')}</span>
                          <span className="text-[8px] text-gray-400 uppercase leading-none mt-0.5">{format(sentDate, 'MMM')}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-instagram-pink transition">
                            {digest.subject || `Digest · ${format(sentDate, 'MMM d')}`}
                          </p>
                          {digest.summary && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                              {digest.summary}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-gray-300">
                              {digest.post_count} {digest.post_count === 1 ? 'post' : 'posts'}
                            </span>
                            <span className="text-gray-200">·</span>
                            <span className="text-[10px] text-gray-300">
                              {format(sentDate, 'h:mm a')}
                            </span>
                            {digest.sent_to_followers_count > 0 && (
                              <>
                                <span className="text-gray-200">·</span>
                                <span className="text-[10px] text-gray-300">
                                  {digest.sent_to_followers_count} follower{digest.sent_to_followers_count !== 1 ? 's' : ''}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <svg className="w-4 h-4 text-gray-300 shrink-0 mt-1 group-hover:text-gray-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface DigestGroup {
  label: string
  digests: Digest[]
}

function groupDigests(digests: Digest[]): DigestGroup[] {
  const groups: DigestGroup[] = []
  const buckets: Record<string, Digest[]> = {}

  for (const digest of digests) {
    const date = new Date(digest.sent_at)
    let label: string

    if (isToday(date)) {
      label = 'Today'
    } else if (isYesterday(date)) {
      label = 'Yesterday'
    } else if (isThisWeek(date)) {
      label = 'This Week'
    } else if (isThisMonth(date)) {
      label = 'This Month'
    } else {
      label = format(date, 'MMMM yyyy')
    }

    if (!buckets[label]) buckets[label] = []
    buckets[label].push(digest)
  }

  for (const [label, items] of Object.entries(buckets)) {
    groups.push({ label, digests: items })
  }

  return groups
}
