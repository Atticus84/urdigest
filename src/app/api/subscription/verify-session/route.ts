import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia' as any,
  })
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { session_id } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Retrieve the checkout session from Stripe
    const session = await getStripe().checkout.sessions.retrieve(session_id, {
      expand: ['subscription'],
    })

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }

    const subscription = session.subscription as Stripe.Subscription

    // Update user's subscription status in the database
    await supabaseAdmin
      .from('users')
      .update({
        subscription_status: 'active',
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscription?.id || null,
        subscription_started_at: new Date().toISOString(),
        subscription_ends_at: subscription?.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
      })
      .eq('id', authUser.id)

    return NextResponse.json({ status: 'active' })
  } catch (error: any) {
    console.error('Verify session error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to verify session' },
      { status: 500 }
    )
  }
}
