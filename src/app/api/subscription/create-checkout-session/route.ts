import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { ensureUserProfileServer } from '@/lib/supabase/ensure-profile-server'
import { supabaseAdmin } from '@/lib/supabase/admin'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set')
  }
  return new Stripe(key, {
    apiVersion: '2024-12-18.acacia' as any,
  })
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Get authenticated user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get or create user profile
    const user = await ensureUserProfileServer(authUser.id, authUser.email!)

    if (!user) {
      return NextResponse.json(
        { error: 'Failed to load user profile' },
        { status: 500 }
      )
    }

    // Create or get Stripe customer
    let customerId = user.stripe_customer_id

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      })
      customerId = customer.id

      // Save customer ID
      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Create checkout session
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      metadata: {
        user_id: user.id,
      },
    })

    return NextResponse.json({
      checkout_url: session.url,
    })
  } catch (error) {
    console.error('Create checkout session error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
