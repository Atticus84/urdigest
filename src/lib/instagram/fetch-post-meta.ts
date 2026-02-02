/**
 * Fetches Instagram post metadata via the oEmbed API (no auth required).
 * Returns author username and caption/title when available.
 */
export interface InstagramPostMeta {
  author_username: string | null
  caption: string | null
  thumbnail_url: string | null
}

export async function fetchInstagramPostMeta(postUrl: string): Promise<InstagramPostMeta> {
  const empty: InstagramPostMeta = { author_username: null, caption: null, thumbnail_url: null }

  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}`
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) })

    if (!res.ok) {
      console.warn(`oEmbed fetch failed for ${postUrl}: ${res.status}`)
      return empty
    }

    const data = await res.json()

    return {
      author_username: data.author_name || null,
      caption: data.title || null,
      thumbnail_url: data.thumbnail_url || null,
    }
  } catch (error) {
    console.warn('Failed to fetch Instagram oEmbed data:', error)
    return empty
  }
}
