'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import type { Digest, SavedPost } from '@/types/database'

function estimateReadTime(postCount: number): number {
  return Math.max(1, Math.round(postCount * 0.8))
}

interface ParsedPost {
  title: string
  summary: string
  source: string
  savedDate: string
  originalUrl: string
}

function parseDigestHtml(htmlContent: string | null, posts: SavedPost[]): ParsedPost[] {
  if (posts.length > 0) {
    return posts.map((post) => ({
      title: post.caption
        ? post.caption.slice(0, 80) + (post.caption.length > 80 ? '...' : '')
        : `Post by @${post.author_username || 'unknown'}`,
      summary: post.caption || 'No summary available.',
      source: post.author_username ? `@${post.author_username}` : 'Instagram',
      savedDate: post.saved_at,
      originalUrl: post.instagram_url,
    }))
  }
  return []
}

export default function DigestDetailPage() {
  const params = useParams()
  const [digest, setDigest] = useState<Digest | null>(null)
  const [posts, setPosts] = useState<SavedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDigest()
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

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-instagram-pink mx-auto mb-4"></div>
        <p className="text-gray-400 text-sm">Loading digest...</p>
      </div>
    )
  }

  if (error || !digest) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-gray-500 mb-4">{error || 'Digest not found'}</p>
        <Link href="/dashboard" className="text-sm text-instagram-pink font-medium hover:underline">
          &larr; Back to all digests
        </Link>
      </div>
    )
  }

  const sentDate = new Date(digest.sent_at)
  const readTime = estimateReadTime(digest.post_count)
  const parsedPosts = parseDigestHtml(digest.html_content, posts)

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Back nav */}
      <Link
        href="/dashboard"
        className="inline-block text-sm text-instagram-purple hover:text-instagram-pink mb-8 transition"
      >
        &larr; Back to all digests
      </Link>

      {/* Header */}
      <header className="mb-10">
        <h1 className="text-3xl font-semibold text-gray-900 mb-1">
          Your Digest
        </h1>
        <p className="text-lg text-gray-400 mb-3">
          {format(sentDate, 'MMMM d, yyyy')}
        </p>
        <p className="text-sm text-gray-400">
          {digest.post_count} {digest.post_count === 1 ? 'post' : 'posts'} &middot; ~{readTime} min read
        </p>
        <p className="text-sm text-gray-300 mt-1 italic">
          Curated from posts you saved on Instagram.
        </p>
      </header>

      {/* AI-generated intro */}
      {digest.summary && (
        <div className="mb-10 pb-10 border-b border-gray-100">
          <p className="text-gray-600 leading-relaxed">
            {digest.summary}
          </p>
        </div>
      )}

      {/* Post blocks */}
      {parsedPosts.length > 0 ? (
        <div className="space-y-0">
          {parsedPosts.map((post, index) => (
            <article key={index} className={`py-8 ${index < parsedPosts.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <h2 className="text-xl font-medium text-gray-900 mb-2 leading-snug">
                {post.title}
              </h2>
              <p className="text-xs text-gray-300 mb-4">
                From {post.source} &middot; Saved {format(new Date(post.savedDate), 'MMM d')}
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                {post.summary}
              </p>
              <a
                href={post.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-instagram-pink hover:text-instagram-purple font-medium transition"
              >
                View original post &rarr;
              </a>
            </article>
          ))}
        </div>
      ) : digest.html_content ? (
        <div
          className="prose prose-gray max-w-none"
          dangerouslySetInnerHTML={{ __html: digest.html_content }}
        />
      ) : (
        <p className="text-gray-400">No content available for this digest.</p>
      )}

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-300">
          That's all for this digest.
        </p>
      </footer>
    </div>
  )
}
