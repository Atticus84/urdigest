import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Resend webhook events for email open tracking
// See: https://resend.com/docs/dashboard/webhooks/introduction
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const { type, data } = payload

    console.log('Resend webhook received:', type)

    if (type === 'email.opened' && data?.email_id) {
      // Find digest by resend_email_id and set opened_at
      const { error } = await supabaseAdmin
        .from('digests')
        .update({ opened_at: new Date().toISOString() })
        .eq('resend_email_id', data.email_id)
        .is('opened_at', null) // Only set on first open

      if (error) {
        console.error('Failed to record email open:', error)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Resend webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
