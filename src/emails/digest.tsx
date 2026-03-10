import { NewsletterContent, NewsletterSection } from '@/lib/ai/summarize'

/** Escape HTML special characters to prevent injection in email templates */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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

/**
 * Morning Brew-inspired color palette.
 *
 * Morning Brew uses a very restrained palette:
 *   - Nearly all black text on white
 *   - One accent color for section labels and links
 *   - Light grays for dividers and muted text
 */
const c = {
  bg: '#ffffff',
  pageBg: '#f4f4f4',
  text: '#292929',
  textLight: '#585858',
  textMuted: '#9a9a9a',
  accent: '#0077cc',     // Brew-style blue for links
  headline: '#292929',
  divider: '#e6e6e6',
  pillBg: '#292929',
  pillText: '#ffffff',
  cardBg: '#f9f9f9',
  buttonBg: '#292929',
  buttonText: '#ffffff',
}

// Section label colors — Morning Brew uses colored ALL CAPS labels to
// visually separate content categories
const labelColors = ['#0077cc', '#7c3aed', '#059669', '#dc2626', '#ea580c', '#0891b2']

export function DigestEmail({ newsletter, date, postCount, followerContext }: DigestEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const isFollower = !!followerContext
  const readMin = Math.max(1, Math.ceil(postCount * 1.2))

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>urdigest — ${date}</title>
  <!--[if mso]>
  <style>body,table,td{font-family:Arial,Helvetica,sans-serif !important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${c.pageBg};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:${c.text};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${c.pageBg};">
    <tr>
      <td align="center" style="padding:20px 12px;">

        <!-- ====== OUTER WRAPPER — 560px like Brew ====== -->
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:${c.bg};border:1px solid ${c.divider};border-radius:4px;">

          <!-- ====== MASTHEAD ====== -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:3px solid ${c.text};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:26px;font-weight:800;color:${c.text};letter-spacing:-0.5px;line-height:1;">urdigest</td>
                  <td style="text-align:right;font-size:13px;color:${c.textMuted};line-height:1;vertical-align:bottom;">${date}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ====== GREETING + META ====== -->
          <tr>
            <td style="padding:24px 32px 4px;">
              <p style="margin:0 0 16px;font-size:17px;line-height:1.55;color:${c.text};">${escapeHtml(newsletter.greeting)}</p>
              <p style="margin:0;font-size:12px;color:${c.textMuted};text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">${postCount} ${postCount === 1 ? 'story' : 'stories'} &nbsp;·&nbsp; ${readMin} min read</p>
            </td>
          </tr>

          <!-- ====== THIN DIVIDER ====== -->
          <tr><td style="padding:16px 32px 0;"><hr style="margin:0;border:0;border-top:1px solid ${c.divider};"></td></tr>

          <!-- ====== STORIES ====== -->
          ${newsletter.sections.map((section, i) => {
            const color = labelColors[i % labelColors.length]
            const isLast = i === newsletter.sections.length - 1
            return renderSection(section, i, color, isLast, c)
          }).join('')}

          <!-- ====== BIG PICTURE / CLOSING ====== -->
          ${newsletter.big_picture ? `
          <tr>
            <td style="padding:8px 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${c.cardBg};border-radius:4px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${c.textMuted};text-transform:uppercase;letter-spacing:1px;">The Big Picture</p>
                    <p style="margin:0;font-size:15px;line-height:1.65;color:${c.text};">${escapeHtml(newsletter.big_picture!)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- ====== SHARE / FOLLOWER BANNER ====== -->
          <tr>
            <td style="padding:0 32px 24px;">
              <hr style="margin:0 0 24px;border:0;border-top:1px solid ${c.divider};">
              ${isFollower ? `
              <p style="margin:0;font-size:13px;color:${c.textLight};text-align:center;line-height:1.5;">
                You're receiving this because you follow <b style="color:${c.text};">${followerContext!.creatorName}</b>.
              </p>
              ` : `
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;">
                    <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:${c.text};">Enjoying this? Share it with a friend.</p>
                    <a href="${appUrl}/dashboard/settings#sharing" style="display:inline-block;background-color:${c.buttonBg};color:${c.buttonText};text-decoration:none;font-size:13px;font-weight:600;padding:10px 24px;border-radius:4px;">Share Your Digest &rarr;</a>
                  </td>
                </tr>
              </table>
              `}
            </td>
          </tr>

          <!-- ====== FOOTER ====== -->
          <tr>
            <td style="padding:20px 32px;background-color:${c.cardBg};border-top:1px solid ${c.divider};border-radius:0 0 4px 4px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;">
                    <p style="margin:0 0 8px;font-size:12px;color:${c.textMuted};line-height:1.5;">
                      ${isFollower ? `
                      <a href="${appUrl}/api/followers/unsubscribe?token=${followerContext!.unsubscribeToken}" style="color:${c.textMuted};text-decoration:underline;">Unsubscribe</a>
                      ` : `
                      <a href="${appUrl}/dashboard/settings" style="color:${c.textMuted};text-decoration:underline;">Settings</a>
                      <span style="margin:0 6px;color:${c.divider};">|</span>
                      <a href="${appUrl}/unsubscribe" style="color:${c.textMuted};text-decoration:underline;">Unsubscribe</a>
                      `}
                    </p>
                    <p style="margin:0;font-size:11px;color:${c.textMuted};">
                      <b style="color:${c.textLight};">urdigest</b> &middot; Your saved posts, digested daily
                    </p>
                  </td>
                </tr>
              </table>
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


/**
 * Render a single story section in Morning Brew style.
 *
 * Morning Brew's signature layout per story:
 *   1. ALL CAPS colored section label (small, bold, spaced)
 *   2. Bold headline condensed into the first line of the body (not a separate H2)
 *   3. Short, punchy paragraphs — conversational and skimmable
 *   4. Key takeaways in a subtle card
 *   5. Simple text-style link at the end ("View on Instagram →")
 *
 * No giant buttons, no heavy cards, no decorative elements.
 */
function renderSection(
  section: NewsletterSection,
  index: number,
  labelColor: string,
  isLast: boolean,
  colors: typeof c
): string {
  const hasTakeaways = section.takeaways && section.takeaways.length > 0
  const hasTalkingPoints = section.talking_points && section.talking_points.length > 0
  const hasKeyQuote = section.key_quote && section.key_quote.length > 0
  const hasTitle = section.title && section.title.length > 0
  const headline = escapeHtml(hasTitle ? section.title! : section.headline)
  const hasLede = section.lede && section.lede.length > 0

  // Morning Brew condenses the headline INTO the body text as a bold lead-in.
  const bodyWithInlineHeadline = hasLede
    ? `<b style="color:${colors.headline};">${headline}.</b> ${escapeHtml(section.lede!)}`
    : `<b style="color:${colors.headline};">${headline}.</b> ${escapeHtml(section.body)}`

  return `
          <tr id="section-${index}">
            <td style="padding:20px 32px 0;">

              <!-- Section label — ALL CAPS, colored, small -->
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:${labelColor};text-transform:uppercase;letter-spacing:1.2px;line-height:1;">
                ${section.content_type_emoji || section.emoji} ${escapeHtml(section.content_type_label || 'POST')}${section.author_username ? ` &nbsp;·&nbsp; @${escapeHtml(section.author_username)}` : ''}
              </p>

              <!-- Headline + lede — bold title flows into the paragraph -->
              <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:${colors.text};">${bodyWithInlineHeadline}</p>

              <!-- Body — the deep explanation of the actual content -->
              ${hasLede ? `
              <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${colors.textLight};">${escapeHtml(section.body)}</p>
              ` : ''}

              <!-- Key Quote — pull quote from the creator -->
              ${hasKeyQuote ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
                <tr>
                  <td style="padding:12px 20px;border-left:3px solid ${colors.textMuted};background-color:transparent;">
                    <p style="margin:0;font-size:15px;line-height:1.6;color:${colors.text};font-style:italic;">&ldquo;${escapeHtml(section.key_quote!)}&rdquo;</p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Key Discoveries — the real value extraction -->
              ${hasTakeaways ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
                <tr>
                  <td style="padding:16px 18px;background-color:${colors.cardBg};border-left:3px solid ${labelColor};border-radius:0 4px 4px 0;">
                    <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:${labelColor};text-transform:uppercase;letter-spacing:1px;">&#x1F4A1; Key Discoveries</p>
                    ${section.takeaways!.map(t => `
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${colors.text};padding-left:16px;text-indent:-16px;"><span style="color:${labelColor};font-weight:700;">&#x2022;</span>&nbsp; ${escapeHtml(t)}</p>
                    `).join('')}
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Talking Points — conversation starters -->
              ${hasTalkingPoints ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
                <tr>
                  <td style="padding:14px 18px;background-color:transparent;border:1px solid ${colors.divider};border-radius:4px;">
                    <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:${colors.textMuted};text-transform:uppercase;letter-spacing:1px;">&#x1F4AC; Worth Discussing</p>
                    ${section.talking_points!.map(t => `
                    <p style="margin:0 0 6px;font-size:13px;line-height:1.55;color:${colors.textLight};padding-left:14px;text-indent:-14px;"><span style="color:${colors.textMuted};">&#x2192;</span>&nbsp; ${escapeHtml(t)}</p>
                    `).join('')}
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- "Why you saved it" — italic aside -->
              ${section.why_you_saved_it ? `
              <p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:${colors.textMuted};font-style:italic;">${escapeHtml(section.why_you_saved_it)}</p>
              ` : ''}

              <!-- CTA — simple text link -->
              <p style="margin:0 0 0;font-size:13px;font-weight:600;">
                <a href="${section.instagram_url}" style="color:${colors.accent};text-decoration:none;">View on Instagram &rarr;</a>
              </p>

            </td>
          </tr>

          <!-- Divider between stories -->
          ${!isLast ? `
          <tr><td style="padding:16px 32px 0;"><hr style="margin:0;border:0;border-top:1px solid ${colors.divider};"></td></tr>
          ` : `
          <tr><td style="padding:20px 0 0;"></td></tr>
          `}
  `
}
