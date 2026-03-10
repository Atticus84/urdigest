'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import type { SavedPost } from '@/types/database'

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
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
      setPage(1) // Reset to page 1 on new search
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Fetch results when filters change
  const fetchResults = useCallback(async () => {
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

      const res = await fetch(`/api/posts/search?${params}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
      }
    } catch (error) {
      console.error('Search failed:', error)
    }
    setLoading(false)
  }, [debouncedQuery, postType, author, status, sortBy, sortDir, page])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
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

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Library</h1>
        <p className="text-gray-400 text-sm">
          {totalPosts} {totalPosts === 1 ? 'post' : 'posts'} in your collection
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search captions, transcripts, authors..."
          className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-instagram-pink/20 focus:border-instagram-pink/40 transition"
        />
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
          <kbd className="text-xs text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded font-mono">/</kbd>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Post Type Filter */}
        <div className="flex gap-1.5">
          <button
            onClick={() => { setPostType(''); setPage(1) }}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition ${
              !postType ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            All{totalPosts > 0 ? ` (${totalPosts})` : ''}
          </button>
          {Object.entries(types).map(([type, count]) => (
            <button
              key={type}
              onClick={() => { setPostType(postType === type ? '' : type); setPage(1) }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition ${
                postType === type ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {postTypeEmojis[type] || '📌'} {postTypeLabels[type] || type} ({count})
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-200 mx-1" />

        {/* Author Filter */}
        {authors.length > 0 && (
          <select
            value={author}
            onChange={(e) => { setAuthor(e.target.value); setPage(1) }}
            className="text-xs font-medium px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full border-0 focus:ring-2 focus:ring-instagram-pink/20 cursor-pointer"
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
          className="text-xs font-medium px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full border-0 focus:ring-2 focus:ring-instagram-pink/20 cursor-pointer"
        >
          <option value="">Any status</option>
          <option value="pending">Not yet digested</option>
          <option value="digested">Already digested</option>
          <option value="enriched">Fully enriched</option>
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort */}
        <select
          value={`${sortBy}-${sortDir}`}
          onChange={(e) => {
            const [field, dir] = e.target.value.split('-')
            setSortBy(field as SortField)
            setSortDir(dir as 'asc' | 'desc')
            setPage(1)
          }}
          className="text-xs font-medium px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full border-0 focus:ring-2 focus:ring-instagram-pink/20 cursor-pointer"
        >
          <option value="saved_at-desc">Newest first</option>
          <option value="saved_at-asc">Oldest first</option>
          <option value="author_username-asc">Author A-Z</option>
          <option value="author_username-desc">Author Z-A</option>
        </select>

        {/* View Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            title="Grid view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            title="List view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
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
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            {debouncedQuery ? 'No matches found' : 'Your library is empty'}
          </h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            {debouncedQuery
              ? `No posts matched "${debouncedQuery}". Try a different search or adjust your filters.`
              : 'Share Instagram posts to @urdigest via DM to start building your library.'}
          </p>
          {(postType || author || status || debouncedQuery) && (
            <button
              onClick={() => {
                setQuery('')
                setPostType('')
                setAuthor('')
                setStatus('')
                setPage(1)
              }}
              className="mt-4 text-sm font-medium text-instagram-pink hover:text-instagram-pink/80 transition"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Grid View */}
      {!loading && results && results.posts.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {results.posts.map((post) => (
            <div
              key={post.id}
              onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
              className="group cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 mb-2">
                {post.thumbnail_url ? (
                  <img
                    src={post.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl">{postTypeEmojis[post.post_type || ''] || '📌'}</span>
                  </div>
                )}
                {/* Type badge */}
                <div className="absolute top-2 left-2">
                  <span className="text-[10px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm uppercase tracking-wider">
                    {post.post_type || 'post'}
                  </span>
                </div>
                {/* Enrichment indicator */}
                {post.processing_status === 'completed' && (
                  <div className="absolute top-2 right-2">
                    <span className="text-[10px] bg-green-500/80 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm" title="Enriched">
                      ✓
                    </span>
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition text-white text-sm font-medium">
                    View details
                  </span>
                </div>
              </div>
              {/* Meta */}
              <div className="px-1">
                {post.author_username && (
                  <p className="text-xs font-medium text-gray-900 truncate">@{post.author_username}</p>
                )}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {format(new Date(post.saved_at), 'MMM d, yyyy')}
                </p>
                {post.caption && (
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1 leading-relaxed">{post.caption}</p>
                )}
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
                className={`flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-50/50 transition ${
                  index < results.posts.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                {/* Thumbnail */}
                {post.thumbnail_url ? (
                  <img src={post.thumbnail_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                    <span className="text-2xl">{postTypeEmojis[post.post_type || ''] || '📌'}</span>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {post.author_username && (
                      <span className="text-sm font-medium text-gray-900">@{post.author_username}</span>
                    )}
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {post.post_type || 'post'}
                    </span>
                    {post.processing_status === 'completed' && (
                      <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
                        Enriched
                      </span>
                    )}
                    {post.processed && (
                      <span className="text-[10px] bg-purple-50 text-instagram-purple px-2 py-0.5 rounded-full font-medium">
                        Digested
                      </span>
                    )}
                  </div>
                  {post.caption && (
                    <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{post.caption}</p>
                  )}
                  <p className="text-xs text-gray-300 mt-1.5">
                    Saved {format(new Date(post.saved_at), 'MMM d, yyyy')}
                  </p>
                </div>

                {/* Expand indicator */}
                <div className="shrink-0 pt-1">
                  <svg
                    className={`w-4 h-4 text-gray-300 transition-transform ${expandedPost === post.id ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedPost === post.id && (
                <PostDetail post={post} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Expanded Post Detail (Grid mode - modal-style) */}
      {viewMode === 'grid' && expandedPost && results && (
        <PostDetailModal
          post={results.posts.find(p => p.id === expandedPost)!}
          onClose={() => setExpandedPost(null)}
        />
      )}

      {/* Pagination */}
      {!loading && results && results.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400 mx-4">
            Page {page} of {results.totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(results.totalPages, page + 1))}
            disabled={page >= results.totalPages}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

/** Inline expanded detail for list view */
function PostDetail({ post }: { post: SavedPost }) {
  return (
    <div className="px-4 pb-4 bg-gray-50/50 border-b border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Left: Content */}
        <div className="space-y-3">
          {post.transcript_text && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Transcript</p>
              <p className="text-sm text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 max-h-40 overflow-y-auto">
                {post.transcript_text}
              </p>
            </div>
          )}
          {post.transcript_summary && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">AI Summary</p>
              <p className="text-sm text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100">
                {post.transcript_summary}
              </p>
            </div>
          )}
          {post.ocr_text && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Text from Images (OCR)</p>
              <p className="text-sm text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 max-h-40 overflow-y-auto">
                {post.ocr_text}
              </p>
            </div>
          )}
          {post.caption && !post.transcript_text && !post.ocr_text && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Caption</p>
              <p className="text-sm text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100">
                {post.caption}
              </p>
            </div>
          )}
        </div>

        {/* Right: Metadata */}
        <div className="space-y-3">
          <div className="bg-white rounded-lg p-3 border border-gray-100 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Type</span>
              <span className="text-gray-700 font-medium capitalize">{post.post_type || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Saved</span>
              <span className="text-gray-700">{format(new Date(post.saved_at), 'MMM d, yyyy h:mm a')}</span>
            </div>
            {post.posted_at && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Posted</span>
                <span className="text-gray-700">{format(new Date(post.posted_at), 'MMM d, yyyy')}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Confidence</span>
              <span className={`font-medium ${
                post.content_confidence === 'high' ? 'text-green-600' :
                post.content_confidence === 'medium' ? 'text-yellow-600' : 'text-gray-400'
              }`}>
                {post.content_confidence || 'Pending'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Status</span>
              <span className="text-gray-700 capitalize">{post.processing_status}</span>
            </div>
          </div>

          <a
            href={post.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-sm font-medium bg-gray-900 text-white py-2.5 rounded-lg hover:bg-gray-800 transition"
          >
            View on Instagram →
          </a>
        </div>
      </div>
    </div>
  )
}

/** Modal detail for grid view */
function PostDetailModal({ post, onClose }: { post: SavedPost; onClose: () => void }) {
  if (!post) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            {post.author_username && (
              <span className="text-sm font-semibold text-gray-900">@{post.author_username}</span>
            )}
            <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {post.post_type || 'post'}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Thumbnail */}
        {post.thumbnail_url && (
          <div className="px-6 pt-4">
            <img
              src={post.thumbnail_url}
              alt=""
              className="w-full max-h-64 object-cover rounded-xl"
            />
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4">
          <PostDetail post={post} />
        </div>
      </div>
    </div>
  )
}
