'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        router.push('/login')
        return
      }
      setUser(user)
      setLoading(false)
    })
  }, [router])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navLinks = [
    { href: '/dashboard', label: 'Home', icon: '📬' },
    { href: '/dashboard/library', label: 'Library', icon: '📚' },
    { href: '/dashboard/ask', label: 'Ask AI', icon: '🧠' },
    { href: '/dashboard/sharing', label: 'Share', icon: '🔗' },
    { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname.startsWith('/dashboard/digests')
    }
    return pathname.startsWith(href)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-instagram-pink mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Top bar — minimal on mobile, full nav on desktop */}
      <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center h-12 md:h-14">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center shrink-0">
              <span className="text-lg font-bold bg-gradient-to-r from-instagram-pink to-instagram-purple bg-clip-text text-transparent">
                urdigest
              </span>
            </Link>

            {/* Desktop Nav — hidden on mobile */}
            <div className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${
                    isActive(link.href)
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-1.5">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Desktop right side */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/dashboard/subscription"
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition ${
                  pathname.startsWith('/dashboard/subscription')
                    ? 'bg-instagram-pink text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                Account
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-400 hover:text-gray-600 font-medium transition"
              >
                Log out
              </button>
            </div>

            {/* Mobile: account + menu button */}
            <div className="flex md:hidden items-center gap-2">
              <Link
                href="/dashboard/subscription"
                className="text-xs font-medium px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full"
              >
                Account
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-400 hover:text-gray-600 -mr-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile dropdown (for secondary items like log out) */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-3 border-t border-gray-100 pt-2 space-y-1">
              <Link
                href="/dashboard/subscription"
                className="block text-sm font-medium text-gray-500 px-3 py-2.5 hover:bg-gray-50 rounded-lg"
              >
                Account & Subscription
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left text-sm font-medium text-gray-400 px-3 py-2.5 hover:bg-gray-50 rounded-lg"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main content — padded for bottom tab bar on mobile */}
      <main className="max-w-6xl mx-auto px-4 pt-4 pb-24 md:pb-8 md:pt-8">
        {children}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex justify-around items-center h-16 px-2 pb-safe">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center flex-1 py-2 min-w-0 transition-colors ${
                isActive(link.href) ? 'text-instagram-pink' : 'text-gray-400'
              }`}
            >
              <span className="text-xl leading-none mb-0.5">{link.icon}</span>
              <span className={`text-[10px] font-medium truncate ${
                isActive(link.href) ? 'text-instagram-pink' : 'text-gray-400'
              }`}>
                {link.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Safe area spacer styles */}
      <style jsx global>{`
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 0px); }
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
      `}</style>
    </div>
  )
}
