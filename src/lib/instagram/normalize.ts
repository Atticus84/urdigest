import { SavedPost } from '@/types/database'

/**
 * Instagram Content Type Enum
 */
export type InstagramContentType = 'REEL' | 'VIDEO' | 'CAROUSEL' | 'IMAGE' | 'UNKNOWN'

/**
 * Content confidence level based on available metadata
 */
export type ContentConfidence = 'low' | 'medium' | 'high'

/**
 * Canonical normalized Instagram content item
 * This is the single source of truth for rendering digest items
 */
export interface NormalizedDigestItem {
  id: string
  url: string
  igType: InstagramContentType
  creatorHandle: string | null
  creatorName: string | null
  creatorProfileUrl: string | null
  postedAt: string | null
  thumbnailUrl: string | null
  captionText: string | null
  mediaCount: number
  audioTitle: string | null
  transcriptText: string | null
  ocrText: string | null
  extractedTextSummary: string
  confidence: ContentConfidence

  // These fields will be populated by AI summarization
  aiSummary?: string
  keyTakeaways?: string[]
  tags?: string[]

  // Original database record for reference
  _rawPost: SavedPost
}

/**
 * Enhanced content type detection based on URL patterns and metadata
 */
export function detectInstagramContentType(
  url: string,
  postType: string | null,
  mediaUrls: any
): InstagramContentType {
  const urlLower = url.toLowerCase()

  // Reel detection - most specific
  if (urlLower.includes('/reel/') || postType === 'reel') {
    return 'REEL'
  }

  // Video detection
  if (postType === 'video' || postType === 'clip' || postType === 'animated_image_share') {
    return 'VIDEO'
  }

  // Carousel detection - check if multiple media URLs exist
  if (postType === 'carousel' || (Array.isArray(mediaUrls) && mediaUrls.length > 1)) {
    return 'CAROUSEL'
  }

  // Image post (standard /p/ posts)
  if (urlLower.includes('/p/') || postType === 'photo' || postType === 'image') {
    return 'IMAGE'
  }

  // Default to unknown if we can't determine
  return 'UNKNOWN'
}

/**
 * Calculate confidence level based on available metadata
 */
export function calculateConfidence(item: {
  captionText: string | null
  creatorHandle: string | null
  thumbnailUrl: string | null
  igType: InstagramContentType
}): ContentConfidence {
  let score = 0

  // Caption adds significant value
  if (item.captionText && item.captionText.length > 20) {
    score += 3
  } else if (item.captionText && item.captionText.length > 0) {
    score += 1
  }

  // Creator info adds value
  if (item.creatorHandle) {
    score += 2
  }

  // Thumbnail presence
  if (item.thumbnailUrl) {
    score += 1
  }

  // Known content type adds confidence
  if (item.igType !== 'UNKNOWN') {
    score += 1
  }

  // Scoring:
  // 7+ = high (caption + creator + thumbnail + type)
  // 3-6 = medium (some metadata)
  // 0-2 = low (minimal data)
  if (score >= 7) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

/**
 * Extract text summary from available metadata (caption, creator, type)
 */
export function extractTextSummary(item: {
  captionText: string | null
  creatorHandle: string | null
  igType: InstagramContentType
}): string {
  const parts: string[] = []

  // Start with content type
  const typeLabel = item.igType === 'UNKNOWN' ? 'Post' : item.igType.toLowerCase()
  parts.push(typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1))

  // Add creator if available
  if (item.creatorHandle) {
    parts.push(`by @${item.creatorHandle}`)
  }

  // Add caption preview if available
  if (item.captionText) {
    const captionPreview = item.captionText.length > 100
      ? item.captionText.slice(0, 100).trim() + '...'
      : item.captionText.trim()
    if (captionPreview.length > 0) {
      parts.push(`— "${captionPreview}"`)
    }
  }

  return parts.join(' ')
}

/**
 * Parse media_urls JSON field to count carousel items
 */
function parseMediaCount(mediaUrls: any): number {
  if (!mediaUrls) return 1

  try {
    if (Array.isArray(mediaUrls)) {
      return mediaUrls.length
    }
    if (typeof mediaUrls === 'object' && Array.isArray(mediaUrls.urls)) {
      return mediaUrls.urls.length
    }
  } catch (e) {
    // Ignore parsing errors
  }

  return 1
}

/**
 * Normalize a SavedPost database record into a canonical NormalizedDigestItem
 *
 * This is the main normalization function that transforms database records
 * into the standard format used throughout the digest generation pipeline.
 */
export function normalizeInstagramPost(post: SavedPost): NormalizedDigestItem {
  // Parse media URLs to determine carousel count
  const mediaUrls = post.media_urls ? post.media_urls : null
  const mediaCount = parseMediaCount(mediaUrls)

  // Detect content type with enhanced logic
  const igType = detectInstagramContentType(
    post.instagram_url,
    post.post_type,
    mediaUrls
  )

  // Build normalized item
  const item: NormalizedDigestItem = {
    id: post.id,
    url: post.instagram_url,
    igType,
    creatorHandle: post.author_username || null,
    creatorName: null, // Not currently available from oEmbed
    creatorProfileUrl: post.author_profile_url || null,
    postedAt: post.posted_at || null,
    thumbnailUrl: post.thumbnail_url || null,
    captionText: post.caption || null,
    mediaCount,
    audioTitle: null, // Not available (would require video metadata extraction)
    transcriptText: null, // Not available (would require transcription service)
    ocrText: null, // Not available (would require OCR service)
    extractedTextSummary: '',
    confidence: 'low', // Will be calculated below
    _rawPost: post,
  }

  // Generate extracted text summary
  item.extractedTextSummary = extractTextSummary(item)

  // Calculate confidence
  item.confidence = calculateConfidence(item)

  return item
}

/**
 * Normalize an array of posts
 */
export function normalizeInstagramPosts(posts: SavedPost[]): NormalizedDigestItem[] {
  return posts.map(normalizeInstagramPost)
}

/**
 * Get a human-readable content type label for display
 */
export function getContentTypeLabel(type: InstagramContentType): string {
  switch (type) {
    case 'REEL': return 'Reel'
    case 'VIDEO': return 'Video'
    case 'CAROUSEL': return 'Carousel'
    case 'IMAGE': return 'Post'
    case 'UNKNOWN': return 'Content'
  }
}

/**
 * Get a badge emoji for content type
 */
export function getContentTypeEmoji(type: InstagramContentType): string {
  switch (type) {
    case 'REEL': return '🎬'
    case 'VIDEO': return '▶️'
    case 'CAROUSEL': return '📸'
    case 'IMAGE': return '🖼️'
    case 'UNKNOWN': return '💫'
  }
}
