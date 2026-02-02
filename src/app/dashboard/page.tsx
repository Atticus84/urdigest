'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import type { Digest } from '@/types/database'

function estimateReadTime(postCount: number): number {
  return Math.max(1, Math.round(postCount * 0.8))
}

export default function DigestsPage() {
  const [digests, setDigests] = useState<Digest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDigests()
  }, [])

  const loadDigests = async () => {
    try {
      const response = await fetch('/api/digests/list')
      if (response.ok) {
        const data = await response.json()
        setDigests(data.digests || [])
      }
    } catch (error) {
      console.error('Failed to load digests:', error)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-400 text-sm">Loading your digests...</p>
      </div>
    )
  }

  if (digests.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          You haven't received a digest yet.
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Save Instagram posts and we'll turn them into a readable email-style digest.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/dashboard/posts"
            className="text-sm font-medium text-gray-900 border border-gray-200 px-5 py-2.5 rounded-lg hover:bg-gray-50 transition"
          >
            View how it works
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Digests</h1>
      <p className="text-gray-400 text-sm mb-10">Your reading history</p>

      <div className="space-y-4">
        {digests.map((digest) => {
          const sentDate = new Date(digest.sent_at)
          const readTime = estimateReadTime(digest.post_count)

          return (
            <Link
              key={digest.id}
              href={`/dashboard/digests/${digest.id}`}
              className="block border border-gray-100 rounded-lg p-6 hover:border-gray-200 hover:shadow-sm transition group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-medium text-gray-900 mb-1">
                    Your Digest &middot; {format(sentDate, 'MMM d')}
                  </h2>
                  <p className="text-sm text-gray-400 mb-3">
                    {digest.post_count} {digest.post_count === 1 ? 'post' : 'posts'} &middot; ~{readTime} min read
                  </p>
                  {digest.summary && (
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {digest.summary}
                    </p>
                  )}
                  <p className="text-xs text-gray-300 mt-3">
                    Sent at {format(sentDate, 'h:mm a')}
                  </p>
                </div>
                <span className="text-sm font-medium text-gray-400 group-hover:text-gray-900 transition ml-4 shrink-0">
                  View Digest &rarr;
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
