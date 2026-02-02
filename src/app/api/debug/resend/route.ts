import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      error: 'RESEND_API_KEY not set',
    })
  }

  try {
    const resend = new Resend(apiKey)

    // Verify API key by listing domains
    const { data: domains, error } = await resend.domains.list()

    if (error) {
      return NextResponse.json({
        configured: false,
        error: error.message,
        keyPrefix: apiKey.substring(0, 8),
        keyLength: apiKey.length,
      })
    }

    // Check if urdigest.com domain is verified
    const urdigestDomain = domains?.data?.find((d: any) =>
      d.name === 'urdigest.com'
    )

    return NextResponse.json({
      configured: true,
      keyPrefix: apiKey.substring(0, 8),
      keyLength: apiKey.length,
      domains: domains?.data?.map((d: any) => ({
        name: d.name,
        status: d.status,
        region: d.region,
      })),
      urdigestDomain: urdigestDomain
        ? { status: urdigestDomain.status, region: urdigestDomain.region }
        : 'NOT FOUND - you need to add and verify urdigest.com in Resend',
    })
  } catch (error) {
    return NextResponse.json({
      configured: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      keyPrefix: apiKey.substring(0, 8),
    })
  }
}

// POST: Send a test email to verify delivery works
export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Provide {"email": "you@example.com"}' }, { status: 400 })
    }

    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: 'urdigest <digest@urdigest.com>',
      to: email,
      subject: 'urdigest test email',
      html: '<h1>It works!</h1><p>If you see this, Resend is configured correctly.</p>',
    })

    if (error) {
      return NextResponse.json({
        sent: false,
        error: error.message,
        hint: error.message.includes('not verified')
          ? 'Your sending domain (urdigest.com) is not verified in Resend. Add DNS records in Resend dashboard.'
          : error.message.includes('not allowed')
          ? 'Free Resend plan can only send to the account owner email. Upgrade or verify your domain.'
          : undefined,
      })
    }

    return NextResponse.json({
      sent: true,
      emailId: data?.id,
      to: email,
      message: 'Test email sent. Check your inbox (and spam folder).',
    })
  } catch (error) {
    return NextResponse.json({
      sent: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
