import { NewsletterContent } from '@/lib/ai/summarize'

interface DigestEmailProps {
  newsletter: NewsletterContent
  date: string
  postCount: number
  followerContext?: {
    unsubscribeToken: string
    creatorName: string
    followSlug?: string | null
  }
}

// Morning Brew-inspired color palette
const colors = {
  primary: '#0066CC',      // Morning Brew blue
  primaryDark: '#004C99',
  accent: '#E4405F',       // Instagram pink for links
  text: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#999999',
  background: '#f5f5f5',
  white: '#ffffff',
  border: '#e0e0e0',
  cardBg: '#fafafa',
}

// Category colors for visual variety
const categoryColors = [
  '#0066CC', // Blue
  '#7C3AED', // Purple
  '#059669', // Green
  '#DC2626', // Red
  '#EA580C', // Orange
  '#0891B2', // Teal
]

export function DigestEmail({ newsletter, date, postCount, followerContext }: DigestEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const isFollower = !!followerContext

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>urdigest - ${date}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.background};">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

          <!-- Header with logo -->
          <tr>
            <td style="padding: 0 0 24px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.white}; border-radius: 12px 12px 0 0; border-bottom: 4px solid ${colors.primary};">
                <tr>
                  <td style="padding: 28px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="font-size: 28px; font-weight: 800; color: ${colors.primary}; letter-spacing: -1px; text-transform: lowercase;">urdigest</span>
                        </td>
                        <td style="text-align: right; vertical-align: middle;">
                          <span style="font-size: 14px; font-weight: 600; color: ${colors.textSecondary};">${date}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main content card -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.white}; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

                <!-- Greeting section -->
                <tr>
                  <td style="padding: 32px 32px 16px;">
                    <p style="margin: 0 0 16px 0; font-size: 18px; color: ${colors.text}; line-height: 1.6; font-weight: 500;">${newsletter.greeting}</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: ${colors.primary}; border-radius: 20px; padding: 6px 16px;">
                          <span style="font-size: 12px; font-weight: 700; color: ${colors.white}; text-transform: uppercase; letter-spacing: 0.5px;">${postCount} ${postCount === 1 ? 'post' : 'posts'} in today's digest</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding: 0 32px;">
                    <hr style="margin: 16px 0; border: 0; border-top: 1px solid ${colors.border};">
                  </td>
                </tr>

                <!-- Content sections -->
                ${newsletter.sections.map((section, index) => {
                  const categoryColor = categoryColors[index % categoryColors.length]
                  return `
                <tr>
                  <td style="padding: 0 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 24px 0;">
                          <!-- Category label -->
                          <table cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                            <tr>
                              <td style="background-color: ${categoryColor}; border-radius: 4px; padding: 4px 10px;">
                                <span style="font-size: 11px; font-weight: 700; color: ${colors.white}; text-transform: uppercase; letter-spacing: 0.5px;">${section.emoji} ${section.author_username ? `@${section.author_username}` : 'Featured'}</span>
                              </td>
                            </tr>
                          </table>

                          <!-- Headline -->
                          <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 700; color: ${colors.text}; line-height: 1.3;">${section.headline}</h2>

                          <!-- Body -->
                          <p style="margin: 0 0 16px 0; font-size: 16px; color: ${colors.textSecondary}; line-height: 1.7;">${section.body}</p>

                          <!-- CTA Link -->
                          <a href="${section.instagram_url}" style="display: inline-block; font-size: 14px; font-weight: 600; color: ${colors.primary}; text-decoration: none; border-bottom: 2px solid ${colors.primary}; padding-bottom: 2px;">View on Instagram &rarr;</a>
                        </td>
                      </tr>
                    </table>
                    ${index < newsletter.sections.length - 1 ? `<hr style="margin: 0; border: 0; border-top: 1px solid ${colors.border};">` : ''}
                  </td>
                </tr>
                `}).join('')}

                <!-- Big Picture -->
                ${newsletter.big_picture ? `
                <tr>
                  <td style="padding: 16px 32px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 24px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); background-color: ${colors.cardBg}; border-left: 4px solid ${colors.primary}; border-radius: 0 8px 8px 0;">
                          <table cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
                            <tr>
                              <td style="background-color: ${colors.text}; border-radius: 4px; padding: 4px 10px;">
                                <span style="font-size: 10px; font-weight: 700; color: ${colors.white}; text-transform: uppercase; letter-spacing: 1px;">The Big Picture</span>
                              </td>
                            </tr>
                          </table>
                          <p style="margin: 0; font-size: 16px; color: ${colors.text}; line-height: 1.7; font-style: italic;">${newsletter.big_picture}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}

              </table>
            </td>
          </tr>

          <!-- Sharing / Attribution card -->
          <tr>
            <td style="padding: 16px 0;">
              ${isFollower ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.white}; border-radius: 12px;">
                <tr>
                  <td style="padding: 24px 32px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: ${colors.textSecondary};">
                      You're receiving this because you follow <strong style="color: ${colors.text};">${followerContext!.creatorName}</strong>'s digest.
                    </p>
                  </td>
                </tr>
              </table>
              ` : `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.white}; border-radius: 12px;">
                <tr>
                  <td style="padding: 28px 32px; text-align: center;">
                    <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: ${colors.text};">Know someone who'd enjoy this?</p>
                    <a href="${appUrl}/dashboard/settings#sharing" style="display: inline-block; background-color: ${colors.primary}; color: ${colors.white}; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 8px;">Share Your Digest</a>
                  </td>
                </tr>
              </table>
              `}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center;">
              ${isFollower ? `
              <p style="margin: 0 0 12px 0; font-size: 13px; color: ${colors.textMuted};">
                <a href="${appUrl}/api/followers/unsubscribe?token=${followerContext!.unsubscribeToken}" style="color: ${colors.textSecondary}; text-decoration: underline;">Unsubscribe from this digest</a>
              </p>
              ` : `
              <p style="margin: 0 0 12px 0; font-size: 13px; color: ${colors.textMuted};">
                <a href="${appUrl}/dashboard/settings" style="color: ${colors.textSecondary}; text-decoration: underline;">Manage preferences</a>
                <span style="margin: 0 8px; color: ${colors.border};">|</span>
                <a href="${appUrl}/unsubscribe" style="color: ${colors.textSecondary}; text-decoration: underline;">Unsubscribe</a>
              </p>
              `}
              <p style="margin: 0; font-size: 12px; color: ${colors.textMuted};">
                <span style="font-weight: 600; color: ${colors.primary};">urdigest</span> &middot; Your saved posts, digested daily
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
