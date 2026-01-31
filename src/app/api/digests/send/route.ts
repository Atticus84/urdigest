import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateDigestForUser } from '@/lib/digest/generate'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  try {
    const supabase = createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user exists in users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has digest enabled and valid subscription
    if (!userData.digest_enabled) {
      return NextResponse.json({ error: 'Digest is disabled for this user' }, { status: 400 })
    }

    if (!['trial', 'active'].includes(userData.subscription_status)) {
      return NextResponse.json({ error: 'Invalid subscription status' }, { status: 400 })
    }

    // Generate and send digest directly (not via Inngest)
    const result = await generateDigestForUser(userData)

    if (result.skipped) {
      const message = result.reason === 'trial_used'
        ? 'Your trial digest has already been sent. Upgrade to Premium to continue.'
        : 'No pending posts to include in digest'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Digest sent successfully',
      postsCount: result.postsCount,
    })
  } catch (error: any) {
    console.error('Failed to send digest:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send digest. Please try again.' },
      { status: 500 }
    )
  }
}
