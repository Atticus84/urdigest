'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'

interface FollowPageData {
  digest_name: string
  description: string | null
  follower_count: number
  recent_digest: {
    id: string
    subject: string
    summary: string | null
    post_count: number
    sent_at: string
  } | null
}

export default function PublicFollowPage() {
  const params = useParams()
  const slug = params.slug as string
  const [data, setData] = useState<FollowPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/follow/${slug}`)
      .then(res => {
        if (!res.ok) { setNotFound(true); return null }
        return res.json()
      })
      .then(d => { if (d) setData(d) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const res = await fetch(`/api/follow/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Something went wrong')
      setMessage(result.message || 'Check your email to confirm.')
      setEmail('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-instagram-pink"></div>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Digest not found</h1>
          <p className="text-gray-500 mb-6">This digest page doesn't exist or sharing is disabled.</p>
          <Link href="/" className="text-instagram-pink font-semibold hover:underline">
            Back to urdigest
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs font-semibold text-instagram-pink uppercase tracking-wide mb-2">urdigest</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{data.digest_name}</h1>
          {data.description && (
            <p className="text-gray-500 leading-relaxed">{data.description}</p>
          )}
          {data.follower_count > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              {data.follower_count} {data.follower_count === 1 ? 'follower' : 'followers'}
            </p>
          )}
        </div>

        {/* Subscribe form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Get this digest in your inbox</h2>
          <p className="text-sm text-gray-400 mb-6">No account needed. Just your email.</p>

          <form onSubmit={handleSubscribe} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
                {message}
              </div>
            )}

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition"
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-instagram-pink text-white py-3 rounded-lg text-sm font-semibold hover:bg-instagram-pink/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Subscribing...' : 'Follow this digest'}
            </button>
          </form>
        </div>

        {/* Recent digest preview */}
        {data.recent_digest && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Latest digest</p>
            <h3 className="text-base font-semibold text-gray-900 mb-1">{data.recent_digest.subject}</h3>
            <p className="text-xs text-gray-400 mb-3">
              {format(new Date(data.recent_digest.sent_at), 'MMMM d, yyyy')} &middot; {data.recent_digest.post_count} {data.recent_digest.post_count === 1 ? 'post' : 'posts'}
            </p>
            {data.recent_digest.summary && (
              <p className="text-sm text-gray-500 leading-relaxed">{data.recent_digest.summary}</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition">
            Powered by urdigest
          </Link>
        </div>
      </div>
    </div>
  )
}
