import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user exists in users table
    const { data: userData, error: userError } = await supabase
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

    // Trigger manual digest via Inngest
    const eventId = await inngest.send({
      name: 'digest/manual',
      data: {
        userId: user.id,
      },
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Digest sending triggered',
      eventId 
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Failed to trigger digest send' }, { status: 500 })
  }
}
