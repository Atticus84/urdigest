import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Resend webhook event types we care about
type ResendEvent = {
  type: string
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    [key: string]: any
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('RESEND_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Verify the webhook signature
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 })
  }

  const body = await request.text()

  // Verify signature using Svix (Resend uses Svix for webhook delivery)
  const { Webhook } = await import('svix')
  const wh = new Webhook(webhookSecret)

  let event: ResendEvent
  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendEvent
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const emailId = event.data.email_id

  try {
    switch (event.type) {
      case 'email.opened': {
        await supabaseAdmin
          .from('digests')
          .update({ opened_at: new Date().toISOString() })
          .eq('resend_email_id', emailId)
          .is('opened_at', null) // only set first open
        break
      }

      case 'email.delivered': {
        await supabaseAdmin
          .from('digests')
          .update({ delivered_at: new Date().toISOString() })
          .eq('resend_email_id', emailId)
        break
      }

      case 'email.bounced': {
        await supabaseAdmin
          .from('digests')
          .update({ bounced_at: new Date().toISOString() })
          .eq('resend_email_id', emailId)
        break
      }

      default:
        // Ignore other event types
        break
    }
  } catch (error) {
    console.error('Error processing Resend webhook:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
