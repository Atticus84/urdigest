'use client'

/**
 * MediaThumbnail – renders either an <img> or a muted <video> (first frame)
 * depending on the post type and URL pattern.
 *
 * Instagram DM shares give us `lookaside.fbsbx.com/ig_messaging_cdn` URLs.
 * For video posts these are actual video files that can't be rendered with <img>.
 */

const VIDEO_TYPES = new Set(['video', 'reel', 'ig_reel', 'clip'])

function looksLikeVideo(url: string, postType?: string | null): boolean {
  if (postType && VIDEO_TYPES.has(postType)) return true
  const lower = url.toLowerCase()
  return (
    lower.includes('.mp4') ||
    lower.includes('.mov') ||
    lower.includes('video')
  )
}

interface MediaThumbnailProps {
  src: string
  postType?: string | null
  alt?: string
  className?: string
  fallback?: React.ReactNode
}

export default function MediaThumbnail({
  src,
  postType,
  alt = '',
  className = '',
  fallback,
}: MediaThumbnailProps) {
  if (looksLikeVideo(src, postType)) {
    return (
      <video
        src={src}
        muted
        playsInline
        preload="metadata"
        className={className}
        onLoadedData={(e) => {
          // Seek to 0.1s to grab an actual frame (some videos show black at 0)
          const video = e.currentTarget
          if (video.duration > 0.1) {
            video.currentTime = 0.1
          }
        }}
        onError={(e) => {
          // If video fails to load, replace with fallback
          const el = e.currentTarget
          if (fallback && el.parentElement) {
            el.style.display = 'none'
          }
        }}
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={(e) => {
        // If image fails to load, hide it
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}
