'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import type { Digest, SavedPost } from '@/types/database'
import MediaThumbnail from '@/components/MediaThumbnail'

function estimateReadTime(postCount: number): number {
  return Math.max(1, Math.round(postCount * 0.8))
}

const postTypeEmojis: Record<string, string> = {
  reel: '🎬',
  video: '🎬',
  photo: '📸',
  carousel: '🖼️',
  ig_reel: '🎬',
  clip: '🎬',
}

export default function DigestDetailPage() {
  const params = useParams()
  const [digest, setDigest] = useState<Digest | null>(null)
  const [posts, setPosts] = useState<SavedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Resend / Share state
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareEmails, setShareEmails] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareMessage, setShareMessage] = useState('')

  useEffect(() => {
    loadDigest()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const loadDigest = async () => {
    try {
      const response = await fetch(`/api/digests/${params.id}`)
      if (!response.ok) {
        setError('Digest not found')
        setLoading(false)
        return
      }
      const data = await response.json()
      setDigest(data.digest)
      setPosts(data.posts || [])
    } catch (err) {
      setError('Failed to load digest')
    }
    setLoading(false)
  }

  const handleResend = async () => {
    setResending(true)
    setResendMessage('')
    try {
      const res = await fetch(`/api/digests/${params.id}/resend`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setResendMessage('Digest resent to your email!')
      } else {
        setResendMessage(data.error || 'Failed to resend')
      }
    } catch {
      setResendMessage('Something went wrong')
    }
    setResending(false)
    setTimeout(() => setResendMessage(''), 4000)
  }

  const handleShare = async () => {
    const emails = shareEmails
      .split(/[,\n]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0)

    if (emails.length === 0) {
      setShareMessage('Enter at least one email address')
      return
    }

    setSharing(true)
    setShareMessage('')
    try {
      const res = await fetch(`/api/digests/${params.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })
      const data = await res.json()
      if (res.ok) {
        setShareMessage(`Sent to ${data.sentCount} ${data.sentCount === 1 ? 'person' : 'people'}!`)
        setTimeout(() => {
          setShowShareModal(false)
          setShareEmails('')
          setShareMessage('')
        }, 2000)
      } else {
        setShareMessage(data.error || 'Failed to send')
      }
    } catch {
      setShareMessage('Something went wrong')
    }
    setSharing(false)
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-instagram-pink mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Loading digest...</p>
      </div>
    )
  }

  if (error || !digest) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-gray-500 mb-4">{error || 'Digest not found'}</p>
        <Link href="/dashboard/digests" className="text-sm text-instagram-pink font-medium hover:underline">
          &larr; Back to digests
        </Link>
      </div>
    )
  }

  const sentDate = new Date(digest.sent_at)
  const readTime = estimateReadTime(digest.post_count)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back nav */}
      <Link
        href="/dashboard/digests"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-6 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All digests
      </Link>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-1 leading-tight">
              {digest.subject || 'Your Digest'}
            </h1>
            <p className="text-sm text-gray-400">
              {format(sentDate, 'MMMM d, yyyy · h:mm a')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span>{digest.post_count} {digest.post_count === 1 ? 'post' : 'posts'}</span>
          <span>·</span>
          <span>~{readTime} min read</span>
          {digest.sent_to_followers_count > 0 && (
            <>
              <span>·</span>
              <span>Sent to {digest.sent_to_followers_count} follower{digest.sent_to_followers_count !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition disabled:opacity-50"
          >
            {resending ? (
              <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Resend to me
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-black rounded-lg hover:bg-gray-800 active:bg-gray-700 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send to others
          </button>
        </div>

        {resendMessage && (
          <p className={`text-xs mt-2 ${resendMessage.includes('!') ? 'text-green-600' : 'text-red-500'}`}>
            {resendMessage}
          </p>
        )}
      </header>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Send this digest</h2>
              <button onClick={() => setShowShareModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Enter email addresses, separated by commas or new lines. Up to 10 at a time.
            </p>
            <textarea
              value={shareEmails}
              onChange={(e) => setShareEmails(e.target.value)}
              placeholder="friend@email.com, family@email.com"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 resize-none"
            />
            {shareMessage && (
              <p className={`text-xs mt-2 ${shareMessage.includes('!') ? 'text-green-600' : 'text-red-500'}`}>
                {shareMessage}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowShareModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition">
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={sharing || !shareEmails.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
              >
                {sharing ? (
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Big picture / Summary */}
      {digest.summary && (
        <div className="mb-8 pb-8 border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">The Big Picture</p>
          <p className="text-gray-600 leading-relaxed">
            {digest.summary}
          </p>
        </div>
      )}

      {/* Posts */}
      {posts.length > 0 ? (
        <div className="space-y-0">
          {posts.map((post, index) => (
            <article
              key={post.id}
              className={`py-6 ${index < posts.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              {/* Post header */}
              <div className="flex items-start gap-3 mb-3">
                {/* Thumbnail */}
                {post.thumbnail_url ? (
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    <MediaThumbnail
                      src={post.thumbnail_url}
                      postType={post.post_type}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg bg-gray-50 shrink-0 flex items-center justify-center">
                    <span className="text-2xl">{postTypeEmojis[post.post_type || ''] || '📌'}</span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {/* Type badge + author */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      {postTypeEmojis[post.post_type || ''] || '📌'} {post.post_type || 'post'}
                    </span>
                    {post.author_username && (
                      <span className="text-xs font-medium text-gray-500">@{post.author_username}</span>
                    )}
                  </div>

                  {/* Caption preview or title */}
                  {post.caption && (
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                      {post.caption}
                    </p>
                  )}

                  <p className="text-[10px] text-gray-300 mt-1">
                    Saved {format(new Date(post.saved_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              {/* Transcript summary — the best content */}
              {post.transcript_summary && (
                <div className="bg-gray-50 rounded-xl p-4 mb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">AI Summary</p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {post.transcript_summary}
                  </p>
                </div>
              )}

              {/* OCR text preview */}
              {!post.transcript_summary && post.ocr_text && (
                <div className="bg-gray-50 rounded-xl p-4 mb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Extracted Text</p>
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
                    {post.ocr_text}
                  </p>
                </div>
              )}

              {/* Confidence indicator */}
              {post.content_confidence && (
                <div className="flex items-center gap-2 text-[10px] text-gray-300">
                  <span>Content quality:</span>
                  <span className={`font-medium ${
                    post.content_confidence === 'high' ? 'text-green-500' :
                    post.content_confidence === 'medium' ? 'text-amber-500' : 'text-gray-400'
                  }`}>
                    {post.content_confidence === 'high' ? '●●●' :
                     post.content_confidence === 'medium' ? '●●○' : '●○○'}
                    {' '}{post.content_confidence}
                  </span>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center py-8">No post details available for this digest.</p>
      )}

      {/* Footer */}
      <footer className="mt-10 pt-6 border-t border-gray-100 text-center pb-4">
        <p className="text-xs text-gray-300">
          That&apos;s all for this digest.
        </p>
      </footer>
    </div>
  )
}
