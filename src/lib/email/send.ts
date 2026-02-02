import { Resend } from 'resend'
import { DigestEmail } from '@/emails/digest'
import { NewsletterContent } from '@/lib/ai/summarize'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

export interface DigestEmailOptions {
  to: string
  newsletter: NewsletterContent
  date: string
  postCount: number
  /** If sending to a follower, include unsubscribe token and creator info */
  followerContext?: {
    unsubscribeToken: string
    creatorName: string
    followSlug?: string | null
  }
}

export async function sendDigestEmail(
  to: string,
  newsletter: NewsletterContent,
  date: string,
  postCount: number,
  followerContext?: DigestEmailOptions['followerContext']
): Promise<string> {
  try {
    const subject = followerContext
      ? `☀️ ${newsletter.subject_line} — via ${followerContext.creatorName}`
      : `☀️ ${newsletter.subject_line}`

    const html = DigestEmail({
      newsletter,
      date,
      postCount,
      followerContext,
    })

    const { data, error } = await getResend().emails.send({
      from: 'urdigest <digest@urdigest.com>',
      to,
      subject,
      html,
      tags: [
        { name: 'type', value: followerContext ? 'digest_follower' : 'digest' },
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

export async function sendFollowerConfirmationEmail(
  to: string,
  digestName: string,
  confirmationToken: string,
  note?: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const confirmUrl = `${appUrl}/api/followers/confirm?token=${confirmationToken}`

  try {
    await getResend().emails.send({
      from: 'urdigest <hello@urdigest.com>',
      to,
      subject: `Confirm: Follow "${digestName}" on urdigest`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%; background: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #1a1a1a;">urdigest</p>
              <hr style="border: 0; border-top: 2px solid #1a1a1a; margin: 12px 0 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #333; line-height: 1.5;">
                You've been invited to follow <strong>${digestName}</strong>.
              </p>
              ${note ? `<p style="margin: 0 0 16px; font-size: 14px; color: #666; line-height: 1.5; padding: 12px; background: #f5f5f5; border-radius: 6px; font-style: italic;">"${note}"</p>` : ''}
              <p style="margin: 0 0 24px; font-size: 14px; color: #666; line-height: 1.5;">
                Click the button below to confirm and start receiving this digest in your inbox.
              </p>
              <a href="${confirmUrl}" style="display: inline-block; padding: 12px 28px; background: #E4405F; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                Confirm &amp; Follow
              </a>
              <p style="margin: 24px 0 0; font-size: 12px; color: #999; line-height: 1.5;">
                If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin: 16px 0 0; font-size: 11px; color: #ccc;">urdigest · Your saved posts, digested daily</p>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
      tags: [
        { name: 'type', value: 'follower_confirmation' },
      ],
    })
  } catch (error) {
    console.error('Failed to send follower confirmation email:', error)
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
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background: #E4405F; color: white; text-decoration: none; border-radius: 8px;">
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
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background: #E4405F; color: white; text-decoration: none; border-radius: 8px;">
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
