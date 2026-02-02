'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import type { User } from '@/types/database'

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
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-400 text-sm">Loading subscription...</p>
      </div>
    )
  }

  const isActive = user?.subscription_status === 'active'
  const isTrial = !user || user.subscription_status === 'trial'
  const isPastDue = user?.subscription_status === 'past_due'
  const isCanceled = user?.subscription_status === 'canceled'

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Subscription</h1>
      <p className="text-gray-400 text-sm mb-10">Manage your plan</p>

      {/* Current Plan */}
      <div className="border border-gray-100 rounded-lg p-6 mb-6">
        <div className="mb-6">
          {isActive && (
            <>
              <span className="inline-block text-xs font-medium text-gray-900 bg-gray-100 px-2.5 py-1 rounded-full mb-3">
                Active
              </span>
              <p className="text-sm text-gray-600 mb-1">
                urdigest Premium
              </p>
              <p className="text-sm text-gray-400">
                $5.00/month
                {user.subscription_ends_at && (
                  <> &middot; Renews {new Date(user.subscription_ends_at).toLocaleDateString()}</>
                )}
              </p>
            </>
          )}

          {isTrial && !user?.trial_digest_sent && (
            <>
              <span className="inline-block text-xs font-medium text-gray-900 bg-gray-100 px-2.5 py-1 rounded-full mb-3">
                Trial
              </span>
              <p className="text-sm text-gray-600">
                Your first digest is free.
              </p>
            </>
          )}

          {isTrial && user?.trial_digest_sent && (
            <>
              <span className="inline-block text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full mb-3">
                Trial ended
              </span>
              <p className="text-sm text-gray-600">
                Upgrade to continue receiving digests.
              </p>
            </>
          )}

          {isPastDue && (
            <>
              <span className="inline-block text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full mb-3">
                Payment failed
              </span>
              <p className="text-sm text-gray-600">
                Please update your payment method.
              </p>
            </>
          )}

          {isCanceled && (
            <>
              <span className="inline-block text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full mb-3">
                Canceled
              </span>
              <p className="text-sm text-gray-600">
                Your subscription has been canceled.
                {user.subscription_ends_at && (
                  <> Access until {new Date(user.subscription_ends_at).toLocaleDateString()}.</>
                )}
              </p>
            </>
          )}
        </div>

        {(isTrial || isCanceled) && (
          <button
            onClick={handleUpgrade}
            disabled={processingCheckout}
            className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingCheckout ? 'Processing...' : 'Upgrade to Premium - $5/month'}
          </button>
        )}

        {(isActive || isPastDue) && (
          <button
            onClick={handleManageSubscription}
            disabled={processingPortal}
            className="w-full border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingPortal ? 'Loading...' : 'Manage Billing'}
          </button>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-300 text-center">
        By subscribing, you agree to our{' '}
        <a href="/terms" className="underline hover:text-gray-500">Terms</a>
        {' '}and{' '}
        <a href="/privacy" className="underline hover:text-gray-500">Privacy Policy</a>.
      </p>
    </div>
  )
}
