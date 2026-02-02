import { NewsletterContent } from '@/lib/ai/summarize'

interface DigestEmailProps {
  newsletter: NewsletterContent
  date: string
  postCount: number
}

export function DigestEmail({ newsletter, date, postCount }: DigestEmailProps) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>urdigest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

          <!-- Masthead -->
          <tr>
            <td style="padding: 24px 32px 20px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 24px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px;">urdigest</span>
                  </td>
                  <td style="text-align: right;">
                    <span style="font-size: 13px; color: #999999;">${date}</span>
                  </td>
                </tr>
              </table>
              <hr style="margin: 16px 0 0 0; border: 0; border-top: 3px solid #1a1a1a;">
            </td>
          </tr>

          <!-- Content area -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 0;">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Greeting -->
                <tr>
                  <td style="padding: 28px 32px 8px;">
                    <p style="margin: 0; font-size: 16px; color: #555555; line-height: 1.5; font-style: italic;">${newsletter.greeting}</p>
                  </td>
                </tr>

                <!-- Post count badge -->
                <tr>
                  <td style="padding: 0 32px 24px;">
                    <span style="display: inline-block; padding: 4px 12px; background-color: #f0f0f0; border-radius: 20px; font-size: 12px; color: #666666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${postCount} ${postCount === 1 ? 'post' : 'posts'} in today's digest</span>
                  </td>
                </tr>

                <!-- Sections -->
                ${newsletter.sections.map((section, index) => `
                <tr>
                  <td style="padding: 0 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 20px 0;">
                          <!-- Headline -->
                          <p style="margin: 0 0 12px 0; font-size: 11px; font-weight: 700; color: #E4405F; text-transform: uppercase; letter-spacing: 1px;">${section.emoji} ${section.headline}</p>

                          <!-- Body -->
                          <p style="margin: 0 0 14px 0; font-size: 15px; color: #333333; line-height: 1.65;">${section.body}</p>

                          <!-- Attribution + link -->
                          <p style="margin: 0; font-size: 13px; color: #999999;">
                            ${section.author_username ? `<span style="color: #666666;">@${section.author_username}</span> · ` : ''}
                            <a href="${section.instagram_url}" style="color: #E4405F; text-decoration: none; font-weight: 600;">Read on Instagram &rarr;</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                    ${index < newsletter.sections.length - 1 ? '<hr style="margin: 0; border: 0; border-top: 1px solid #eeeeee;">' : ''}
                  </td>
                </tr>
                `).join('')}

                <!-- Big Picture -->
                ${newsletter.big_picture ? `
                <tr>
                  <td style="padding: 8px 32px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 20px; background-color: #fafafa; border-left: 3px solid #1a1a1a; border-radius: 0 4px 4px 0;">
                          <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px;">The Big Picture</p>
                          <p style="margin: 0; font-size: 15px; color: #444444; line-height: 1.65;">${newsletter.big_picture}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #999999;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings" style="color: #666666; text-decoration: none;">Manage preferences</a>
                &nbsp;&middot;&nbsp;
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe" style="color: #666666; text-decoration: none;">Unsubscribe</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #cccccc;">urdigest &middot; Your saved posts, digested daily</p>
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
