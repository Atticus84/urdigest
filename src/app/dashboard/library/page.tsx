'use client'

import { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import type { SavedPost } from '@/types/database'
import MediaThumbnail from '@/components/MediaThumbnail'

type ViewMode = 'grid' | 'list'
type SortField = 'saved_at' | 'posted_at' | 'author_username'

interface SearchResults {
  posts: SavedPost[]
  total: number
  page: number
  limit: number
  totalPages: number
  authors: string[]
  typeBreakdown: Record<string, number>
}

const postTypeLabels: Record<string, string> = {
  reel: 'Reels',
  video: 'Videos',
  carousel: 'Carousels',
  photo: 'Photos',
}

const postTypeEmojis: Record<string, string> = {
  reel: '🎬',
  video: '📹',
  carousel: '📸',
  photo: '🖼',
}

export default function LibraryPage() {
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [postType, setPostType] = useState('')
  const [author, setAuthor] = useState('')
  const [status, setStatus] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('saved_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const abortController = new AbortController()

    const fetchResults = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (debouncedQuery) params.set('q', debouncedQuery)
        if (postType) params.set('type', postType)
        if (author) params.set('author', author)
        if (status) params.set('status', status)
        params.set('sort', sortBy)
        params.set('dir', sortDir)
        params.set('page', String(page))
        params.set('limit', '24')

        const res = await fetch(`/api/posts/search?${params}`, {
          signal: abortController.signal,
        })
        if (res.ok) {
          const data = await res.json()
          if (!abortController.signal.aborted) {
            setResults(data)
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Search failed:', error)
        }
      }
      if (!abortController.signal.aborted) {
        setLoading(false)
      }
    }

    fetchResults()
    return () => abortController.abort()
  }, [debouncedQuery, postType, author, status, sortBy, sortDir, page])

  // Keyboard shortcut (desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        searchInputRef.current?.blur()
        setExpandedPost(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const totalPosts = results?.total || 0
  const types = results?.typeBreakdown || {}
  const authors = results?.authors || []
  const hasActiveFilters = !!(postType || author || status)

  return (
    <div>
      {/* Header */}
      <div className="mb-4 md:mb-8">
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-0.5">Library</h1>
        <p className="text-gray-400 text-xs md:text-sm">
          {totalPosts} {totalPosts === 1 ? 'post' : 'posts'} saved
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-3 md:mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts..."
          className="w-full pl-10 md:pl-11 pr-20 py-2.5 md:py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-instagram-pink/20 focus:border-instagram-pink/40 transition"
        />
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1.5">
          {/* Filter toggle button (mobile) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`md:hidden p-2 rounded-lg transition ${
              hasActiveFilters ? 'bg-instagram-pink/10 text-instagram-pink' : 'text-gray-400'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {hasActiveFilters && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-instagram-pink rounded-full" />}
          </button>
          <div className="hidden md:flex items-center pointer-events-none pr-2">
            <kbd className="text-xs text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded font-mono">/</kbd>
          </div>
        </div>
      </div>

      {/* Type pills — horizontal scroll on mobile */}
      <div className="mb-3 md:mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => { setPostType(''); setPage(1) }}
            className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition shrink-0 ${
              !postType ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 active:bg-gray-200'
            }`}
          >
            All{totalPosts > 0 ? ` (${totalPosts})` : ''}
          </button>
          {Object.entries(types).map(([type, count]) => (
            <button
              key={type}
              onClick={() => { setPostType(postType === type ? '' : type); setPage(1) }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition shrink-0 ${
                postType === type ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 active:bg-gray-200'
              }`}
            >
              {postTypeEmojis[type] || '📌'} {postTypeLabels[type] || type} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Expanded filters (mobile toggle, always visible on desktop) */}
      <div className={`${showFilters ? 'block' : 'hidden'} md:flex flex-wrap items-center gap-2 mb-4 md:mb-6`}>
        {/* Author Filter */}
        {authors.length > 0 && (
          <select
            value={author}
            onChange={(e) => { setAuthor(e.target.value); setPage(1) }}
            className="text-xs font-medium px-3 py-2 md:py-1.5 bg-gray-100 text-gray-600 rounded-xl md:rounded-full border-0 focus:ring-2 focus:ring-instagram-pink/20 w-full md:w-auto"
          >
            <option value="">All creators</option>
            {authors.map((a) => (
              <option key={a} value={a}>@{a}</option>
            ))}
          </select>
        )}

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="text-xs font-medium px-3 py-2 md:py-1.5 bg-gray-100 text-gray-600 rounded-xl md:rounded-full border-0 focus:ring-2 focus:ring-instagram-pink/20 w-full md:w-auto"
        >
          <option value="">Any status</option>
          <option value="pending">Not yet digested</option>
          <option value="digested">Already digested</option>
          <option value="enriched">Fully enriched</option>
        </select>

        {/* Sort */}
        <select
          value={`${sortBy}-${sortDir}`}
          onChange={(e) => {
            const [field, dir] = e.target.value.split('-')
            setSortBy(field as SortField)
            setSortDir(dir as 'asc' | 'desc')
            setPage(1)
          }}
          className="text-xs font-medium px-3 py-2 md:py-1.5 bg-gray-100 text-gray-600 rounded-xl md:rounded-full border-0 focus:ring-2 focus:ring-instagram-pink/20 w-full md:w-auto"
        >
          <option value="saved_at-desc">Newest first</option>
          <option value="saved_at-asc">Oldest first</option>
          <option value="author_username-asc">Author A-Z</option>
          <option value="author_username-desc">Author Z-A</option>
        </select>

        {/* View Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-400'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-400'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => { setPostType(''); setAuthor(''); setStatus(''); setPage(1) }}
            className="text-xs text-instagram-pink font-medium w-full md:w-auto text-center py-1"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-instagram-pink mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Searching...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && results && results.posts.length === 0 && (
        <div className="text-center py-16 md:py-20">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-base md:text-lg font-medium text-gray-900 mb-2">
            {debouncedQuery ? 'No matches found' : 'Your library is empty'}
          </h2>
          <p className="text-gray-400 text-sm max-w-sm mx-auto px-4">
            {debouncedQuery
              ? `Nothing matched "${debouncedQuery}". Try different terms.`
              : 'Share Instagram posts to @urdigest via DM to get started.'}
          </p>
        </div>
      )}

      {/* Grid View */}
      {!loading && results && results.posts.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
          {results.posts.map((post) => (
            <div
              key={post.id}
              onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
              className="group cursor-pointer active:opacity-80 transition-opacity"
            >
              <div className="relative aspect-square rounded-lg md:rounded-xl overflow-hidden bg-gray-100 mb-1.5 md:mb-2">
                {post.thumbnail_url ? (
                  <MediaThumbnail
                    src={post.thumbnail_url}
                    postType={post.post_type}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl md:text-3xl">{postTypeEmojis[post.post_type || ''] || '📌'}</span>
                  </div>
                )}
                <div className="absolute top-1.5 left-1.5">
                  <span className="text-[9px] md:text-[10px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm uppercase tracking-wider">
                    {post.post_type || 'post'}
                  </span>
                </div>
                {post.processing_status === 'completed' && (
                  <div className="absolute top-1.5 right-1.5">
                    <span className="text-[9px] bg-green-500/80 text-white px-1 py-0.5 rounded-full backdrop-blur-sm">✓</span>
                  </div>
                )}
              </div>
              <div className="px-0.5">
                {post.author_username && (
                  <p className="text-[11px] md:text-xs font-medium text-gray-900 truncate">@{post.author_username}</p>
                )}
                <p className="text-[10px] md:text-[11px] text-gray-400">
                  {format(new Date(post.saved_at), 'MMM d')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && results && results.posts.length > 0 && viewMode === 'list' && (
        <div className="space-y-0 border border-gray-100 rounded-xl overflow-hidden">
          {results.posts.map((post, index) => (
            <div key={post.id}>
              <div
                onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                className={`flex items-start gap-3 p-3 md:p-4 cursor-pointer active:bg-gray-50 transition ${
                  index < results.posts.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                {post.thumbnail_url ? (
                  <MediaThumbnail
                    src={post.thumbnail_url}
                    postType={post.post_type}
                    className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                    <span className="text-xl md:text-2xl">{postTypeEmojis[post.post_type || ''] || '📌'}</span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    {post.author_username && (
                      <span className="text-sm font-medium text-gray-900">@{post.author_username}</span>
                    )}
                    <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      {post.post_type || 'post'}
                    </span>
                  </div>
                  {post.caption && (
                    <p className="text-xs md:text-sm text-gray-500 line-clamp-2 leading-relaxed">{post.caption}</p>
                  )}
                  <p className="text-[10px] md:text-xs text-gray-300 mt-1">
                    {format(new Date(post.saved_at), 'MMM d, yyyy')}
                  </p>
                </div>

                <svg
                  className={`w-4 h-4 text-gray-300 shrink-0 mt-1 transition-transform ${expandedPost === post.id ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {expandedPost === post.id && <PostDetail post={post} />}
            </div>
          ))}
        </div>
      )}

      {/* Bottom Sheet Modal (grid mode) — slides up from bottom on mobile */}
      {viewMode === 'grid' && expandedPost && results && (
        <PostDetailSheet
          post={results.posts.find(p => p.id === expandedPost)!}
          onClose={() => setExpandedPost(null)}
        />
      )}

      {/* Pagination */}
      {!loading && results && results.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6 md:mt-8">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="text-sm font-medium px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 active:bg-gray-200 transition disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-gray-400">
            {page} / {results.totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(results.totalPages, page + 1))}
            disabled={page >= results.totalPages}
            className="text-sm font-medium px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 active:bg-gray-200 transition disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Hide scrollbar for horizontal filter pills */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}

/** Inline expanded detail for list view */
function PostDetail({ post }: { post: SavedPost }) {
  return (
    <div className="px-3 pb-3 md:px-4 md:pb-4 bg-gray-50/50 border-b border-gray-100">
      <div className="space-y-3 pt-2">
        {post.transcript_text && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Transcript</p>
            <p className="text-xs md:text-sm text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 max-h-32 overflow-y-auto">
              {post.transcript_text}
            </p>
          </div>
        )}
        {post.transcript_summary && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">AI Summary</p>
            <p className="text-xs md:text-sm text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100">
              {post.transcript_summary}
            </p>
          </div>
        )}
        {post.ocr_text && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Image Text (OCR)</p>
            <p className="text-xs md:text-sm text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 max-h-32 overflow-y-auto">
              {post.ocr_text}
            </p>
          </div>
        )}
        {post.caption && !post.transcript_text && !post.ocr_text && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Caption</p>
            <p className="text-xs md:text-sm text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100">
              {post.caption}
            </p>
          </div>
        )}

        {/* Metadata row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
          <span>Type: <b className="text-gray-600 capitalize">{post.post_type || 'Unknown'}</b></span>
          <span>Saved: <b className="text-gray-600">{format(new Date(post.saved_at), 'MMM d, yyyy')}</b></span>
          {post.content_confidence && (
            <span>Confidence: <b className={
              post.content_confidence === 'high' ? 'text-green-600' :
              post.content_confidence === 'medium' ? 'text-yellow-600' : 'text-gray-400'
            }>{post.content_confidence}</b></span>
          )}
        </div>

        <a
          href={post.instagram_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center text-sm font-medium bg-gray-900 text-white py-3 rounded-xl active:bg-gray-700 transition"
        >
          View on Instagram →
        </a>
      </div>
    </div>
  )
}

/** Bottom sheet modal — slides up on mobile, centered on desktop */
function PostDetailSheet({ post, onClose }: { post: SavedPost; onClose: () => void }) {
  if (!post) return null

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />

      {/* Bottom sheet on mobile, centered modal on desktop */}
      <div
        className="absolute bottom-0 left-0 right-0 md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-2xl md:w-full md:mx-4
          bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up md:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center py-2 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-white px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            {post.author_username && (
              <span className="text-sm font-semibold text-gray-900">@{post.author_username}</span>
            )}
            <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              {post.post_type || 'post'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 active:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Media */}
        {post.thumbnail_url && (
          <div className="px-4 md:px-6 pt-3">
            <MediaThumbnail
              src={post.thumbnail_url}
              postType={post.post_type}
              className="w-full max-h-56 md:max-h-64 object-cover rounded-xl"
            />
          </div>
        )}

        {/* Content */}
        <div className="px-4 md:px-6 py-4 pb-safe">
          <PostDetail post={post} />
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up { animation: slideUp 0.25s ease-out; }
      `}</style>
    </div>
  )
}
