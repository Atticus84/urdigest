'use client'

import { useState, useRef, useEffect } from 'react'

interface OEmbedData {
  version: string
  author_name?: string
  provider_name?: string
  type?: string
  width?: number
  html: string
  thumbnail_url?: string
  thumbnail_width?: number
  thumbnail_height?: number
}

export default function OEmbedDemoPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [embedData, setEmbedData] = useState<OEmbedData | null>(null)
  const embedContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!embedData?.html || !embedContainerRef.current) return

    const container = embedContainerRef.current
    // Inject the oEmbed HTML directly via the ref so React's virtual DOM
    // doesn't interfere with the iframe that embed.js produces.
    container.innerHTML = embedData.html

    const win = window as any
    if (win.instgrm?.Embeds) {
      // Script already loaded — just re-process new blockquotes
      win.instgrm.Embeds.process()
    } else {
      // First load: remove any stale script tag, then add a fresh one
      // so its onload fires and auto-processes the blockquote.
      document
        .querySelectorAll('script[src*="instagram.com/embed.js"]')
        .forEach((s) => s.remove())

      const script = document.createElement('script')
      script.src = 'https://www.instagram.com/embed.js'
      script.async = true
      document.body.appendChild(script)
    }

    return () => {
      // Clean up when unmounting or before next embed replaces it
      container.innerHTML = ''
    }
  }, [embedData])

  const fetchEmbed = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setEmbedData(null)

    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please enter an Instagram URL')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(
        `/api/oembed-demo?url=${encodeURIComponent(trimmed)}`
      )
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to fetch embed')
        return
      }

      setEmbedData(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">
        Instagram oEmbed Demo
      </h1>
      <p className="text-gray-400 text-sm mb-10">
        Enter an Instagram post or reel URL to render its oEmbed HTML embed
      </p>

      {/* URL Input Form */}
      <form onSubmit={fetchEmbed} className="space-y-4 mb-10">
        <section>
          <h2 className="text-sm font-medium text-instagram-purple uppercase tracking-wide mb-4">
            Instagram URL
          </h2>
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/ABC123..."
              className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-instagram-pink/30 focus:border-instagram-pink outline-none transition placeholder:text-gray-300"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-instagram-pink text-white rounded-lg text-sm font-medium hover:bg-instagram-pink/90 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? 'Loading...' : 'Embed'}
            </button>
          </div>
        </section>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-8 px-4 py-3 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-instagram-pink mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Fetching embed data...</p>
        </div>
      )}

      {/* Embed Result */}
      {embedData && !loading && (
        <div className="space-y-6">
          {/* Metadata */}
          <section>
            <h2 className="text-sm font-medium text-instagram-purple uppercase tracking-wide mb-4">
              Embed Metadata
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              {embedData.author_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Author</span>
                  <span className="text-gray-900 font-medium">
                    @{embedData.author_name}
                  </span>
                </div>
              )}
              {embedData.type && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Type</span>
                  <span className="text-gray-900">{embedData.type}</span>
                </div>
              )}
              {embedData.width && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Width</span>
                  <span className="text-gray-900">{embedData.width}px</span>
                </div>
              )}
              {embedData.provider_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Provider</span>
                  <span className="text-gray-900">
                    {embedData.provider_name}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Rendered Embed */}
          <section>
            <h2 className="text-sm font-medium text-instagram-purple uppercase tracking-wide mb-4">
              Rendered Embed
            </h2>
            <div
              ref={embedContainerRef}
              className="border border-gray-100 rounded-lg p-4 bg-white overflow-hidden"
            />
          </section>

          {/* Raw HTML */}
          <section>
            <h2 className="text-sm font-medium text-instagram-purple uppercase tracking-wide mb-4">
              Raw HTML
            </h2>
            <pre className="bg-gray-900 text-gray-100 text-xs p-4 rounded-lg overflow-x-auto">
              <code>{embedData.html}</code>
            </pre>
          </section>
        </div>
      )}
    </div>
  )
}
