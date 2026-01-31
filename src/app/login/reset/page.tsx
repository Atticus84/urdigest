'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login/reset/confirm`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <span className="text-3xl">📧</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-instagram-pink to-instagram-purple bg-clip-text text-transparent">
              urdigest
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-2">
            Reset Password
          </h1>
          <p className="text-gray-600">
            Enter your email to receive a password reset link
          </p>
        </div>

        {/* Reset Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {success ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                <p className="font-semibold mb-1">Check your email!</p>
                <p>We've sent a password reset link to {email}</p>
              </div>
              <Link
                href="/login"
                className="block w-full text-center bg-instagram-pink text-white py-3 rounded-lg font-semibold hover:bg-instagram-pink/90 transition"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-instagram-pink focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-instagram-pink text-white py-3 rounded-lg font-semibold hover:bg-instagram-pink/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-instagram-pink font-semibold hover:underline">
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
