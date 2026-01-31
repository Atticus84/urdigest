import { Resend } from 'resend'
import { DigestEmail } from '@/emails/digest'
import { BRAND_COLOR_INSTAGRAM } from '@/lib/constants'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

export interface EmailPost {
  id: string
  title: string
  summary: string
  instagram_url: string
  thumbnail_url: string | null
  author_username: string | null
}

export async function sendDigestEmail(
  to: string,
  posts: EmailPost[],
  date: string
): Promise<string> {
  try {
    const subject = `☀️ Your daily urdigest: ${posts.length} ${posts.length === 1 ? 'post' : 'posts'} you saved`

    const html = DigestEmail({
      posts,
      userEmail: to,
      date,
    })

    const { data, error } = await getResend().emails.send({
      from: 'urdigest <digest@urdigest.com>',
      to,
      subject,
      html,
      tags: [
        { name: 'type', value: 'digest' },
      ],
    })

    if (error) {
      throw error
    }

    return data?.id || ''
  } catch (error) {
    console.error('Resend email error:', error)
    throw error
  }
}

export async function sendTrialEndedEmail(to: string): Promise<void> {
  try {
    await getResend().emails.send({
      from: 'urdigest <hello@urdigest.com>',
      to,
      subject: 'Your urdigest trial has ended',
      html: `
        <h1>Your trial has ended</h1>
        <p>Thanks for trying urdigest! Your free trial digest has been sent.</p>
        <p>To continue receiving daily digests, please upgrade to Premium for just $5/month.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background: ${BRAND_COLOR_INSTAGRAM}; color: white; text-decoration: none; border-radius: 8px;">
          Upgrade to Premium →
        </a>
      `,
      tags: [
        { name: 'type', value: 'trial_ended' },
      ],
    })
  } catch (error) {
    console.error('Failed to send trial ended email:', error)
  }
}

export async function sendPaymentFailedEmail(to: string): Promise<void> {
  try {
    await getResend().emails.send({
      from: 'urdigest <hello@urdigest.com>',
      to,
      subject: 'Payment failed - Update your payment method',
      html: `
        <h1>Payment failed</h1>
        <p>We couldn't process your payment for urdigest.</p>
        <p>Please update your payment method to continue receiving daily digests.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background: ${BRAND_COLOR_INSTAGRAM}; color: white; text-decoration: none; border-radius: 8px;">
          Update Payment Method →
        </a>
      `,
      tags: [
        { name: 'type', value: 'payment_failed' },
      ],
    })
  } catch (error) {
    console.error('Failed to send payment failed email:', error)
  }
}
