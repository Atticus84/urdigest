'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Legacy saved posts page — redirects to the new Library.
 * Keeping the route alive so old bookmarks/links still work.
 */
export default function SavedPostsRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/library')
  }, [router])

  return (
    <div className="text-center py-20">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-instagram-pink mx-auto mb-3" />
      <p className="text-gray-400 text-sm">Redirecting to Library...</p>
    </div>
  )
}
