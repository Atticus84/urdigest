'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import type { User } from '@/types/database'
import { SUPPORT_EMAIL } from '@/lib/constants'

export default function SubscriptionPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [processingPortal, setProcessingPortal] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    const supabase = createClient()
    const { data: authUser } = await supabase.auth.getUser()

    if (authUser.user) {
      const userData = await ensureUserProfile(supabase, authUser.user.id, authUser.user.email!)
      setUser(userData)
    }

    setLoading(false)
  }

  const handleUpgrade = async () => {
    setProcessingCheckout(true)

    try {
      const response = await fetch('/api/subscription/create-checkout-session', {
        method: 'POST',
      })

      const data = await response.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        console.error('No checkout URL returned:', data)
        setProcessingCheckout(false)
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error)
      setProcessingCheckout(false)
    }
  }

  const handleManageSubscription = async () => {
    setProcessingPortal(true)

    try {
      const response = await fetch('/api/subscription/create-portal-session', {
        method: 'POST',
      })

      const { portal_url } = await response.json()
      window.location.href = portal_url
    } catch (error) {
      console.error('Failed to create portal session:', error)
      setProcessingPortal(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-instagram-pink mx-auto mb-4"></div>
        <p className="text-gray-600">Loading subscription...</p>
      </div>
    )
  }

  const isActive = user?.subscription_status === 'active'
  const isTrial = !user || user.subscription_status === 'trial'
  const isPastDue = user?.subscription_status === 'past_due'
  const isCanceled = user?.subscription_status === 'canceled'

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscription</h1>
      <p className="text-gray-600 mb-8">Manage your urdigest subscription</p>

      {/* Current Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Current Plan</h2>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isTrial && !user?.trial_digest_sent && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-3">
                  <span>🎉</span>
                  <span>Trial Active</span>
                </div>
                <p className="text-gray-600 mb-4">
                  You're on the free trial. Your first digest is free!
                </p>
              </>
            )}

            {isTrial && user?.trial_digest_sent && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium mb-3">
                  <span>⏰</span>
                  <span>Trial Ended</span>
                </div>
                <p className="text-gray-600 mb-4">
                  Your trial has ended. Upgrade to continue receiving digests.
                </p>
              </>
            )}

            {isActive && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-3">
                  <span>✓</span>
                  <span>Premium Active</span>
                </div>
                <p className="text-gray-600 mb-2">
                  You're subscribed to urdigest Premium.
                </p>
                <p className="text-sm text-gray-500">
                  Billing: $5.00/month
                  {user.subscription_ends_at && (
                    <> • Renews {new Date(user.subscription_ends_at).toLocaleDateString()}</>
                  )}
                </p>
              </>
            )}

            {isPastDue && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium mb-3">
                  <span>⚠️</span>
                  <span>Payment Failed</span>
                </div>
                <p className="text-gray-600 mb-4">
                  Your last payment failed. Please update your payment method to continue.
                </p>
              </>
            )}

            {isCanceled && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium mb-3">
                  <span>Canceled</span>
                </div>
                <p className="text-gray-600 mb-4">
                  Your subscription has been canceled.
                  {user.subscription_ends_at && (
                    <> Access until {new Date(user.subscription_ends_at).toLocaleDateString()}.</>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t">
          {(isTrial || isCanceled) && (
            <button
              onClick={handleUpgrade}
              disabled={processingCheckout}
              className="w-full bg-instagram-pink text-white py-3 rounded-lg font-semibold hover:bg-instagram-pink/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingCheckout ? 'Processing...' : 'Upgrade to Premium - $5/month'}
            </button>
          )}

          {(isActive || isPastDue) && (
            <button
              onClick={handleManageSubscription}
              disabled={processingPortal}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingPortal ? 'Loading...' : 'Manage Subscription'}
            </button>
          )}
        </div>
      </div>

      {/* Pricing Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">What's Included</h2>
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <span className="text-green-500 text-xl">✓</span>
            <span className="text-gray-700">Unlimited saved posts</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="text-green-500 text-xl">✓</span>
            <span className="text-gray-700">AI-powered summaries</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="text-green-500 text-xl">✓</span>
            <span className="text-gray-700">Daily email digests</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="text-green-500 text-xl">✓</span>
            <span className="text-gray-700">Customizable digest time</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="text-green-500 text-xl">✓</span>
            <span className="text-gray-700">Cancel anytime</span>
          </li>
        </ul>
      </div>

      {/* FAQ */}
      <div className="mt-6 text-sm text-gray-600">
        <p className="mb-2">
          <strong>Questions?</strong> Email us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-instagram-pink hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p>
          By subscribing, you agree to our{' '}
          <a href="/terms" className="text-instagram-pink hover:underline">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" className="text-instagram-pink hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}
