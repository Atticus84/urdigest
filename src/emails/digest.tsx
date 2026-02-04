import { NewsletterContent, NewsletterSection } from '@/lib/ai/summarize'

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

// Helper to generate anchor ID from section headline
function generateAnchorId(headline: string, index: number): string {
  return `section-${index}`
}

// Helper to organize sections into categories for TOC
interface SectionGroup {
  name: string
  emoji: string
  sections: Array<NewsletterSection & { index: number }>
}

function organizeSections(sections: NewsletterSection[]): SectionGroup[] {
  const groups: SectionGroup[] = []
  const featured: Array<NewsletterSection & { index: number }> = []
  const reelsVideos: Array<NewsletterSection & { index: number }> = []
  const carousels: Array<NewsletterSection & { index: number }> = []
  const quickHits: Array<NewsletterSection & { index: number }> = []

  sections.forEach((section, index) => {
    const contentType = section.content_type_label?.toLowerCase() || ''
    const sectionWithIndex = { ...section, index }

    // Categorize based on content type
    if (index === 0) {
      // First item is always featured
      featured.push(sectionWithIndex)
    } else if (contentType.includes('reel') || contentType.includes('video')) {
      reelsVideos.push(sectionWithIndex)
    } else if (contentType.includes('carousel')) {
      carousels.push(sectionWithIndex)
    } else {
      quickHits.push(sectionWithIndex)
    }
  })

  // Build groups based on what we have
  if (featured.length > 0) {
    groups.push({ name: 'Featured', emoji: '⭐', sections: featured })
  }
  if (reelsVideos.length > 0) {
    groups.push({ name: 'Reels & Videos', emoji: '🎬', sections: reelsVideos })
  }
  if (carousels.length > 0) {
    groups.push({ name: 'Carousels & Visuals', emoji: '📸', sections: carousels })
  }
  if (quickHits.length > 0) {
    groups.push({ name: 'Quick Hits', emoji: '⚡', sections: quickHits })
  }

  return groups
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
  const sectionGroups = organizeSections(newsletter.sections)
  const estimatedReadTime = Math.max(1, Math.ceil(postCount * 1.5)) // ~1.5 min per post

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

                <!-- Hero Intro Section -->
                <tr>
                  <td style="padding: 32px 32px 24px;">
                    <!-- Greeting -->
                    <p style="margin: 0 0 20px 0; font-size: 20px; color: ${colors.text}; line-height: 1.5; font-weight: 600;">${newsletter.greeting}</p>

                    <!-- Stats badges -->
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: ${colors.primary}; border-radius: 20px; padding: 6px 16px; margin-right: 8px;">
                          <span style="font-size: 12px; font-weight: 700; color: ${colors.white}; text-transform: uppercase; letter-spacing: 0.5px;">📬 ${postCount} ${postCount === 1 ? 'post' : 'posts'}</span>
                        </td>
                        <td style="width: 8px;"></td>
                        <td style="background-color: ${colors.cardBg}; border: 1px solid ${colors.border}; border-radius: 20px; padding: 6px 16px;">
                          <span style="font-size: 12px; font-weight: 700; color: ${colors.textSecondary}; text-transform: uppercase; letter-spacing: 0.5px;">⏱️ ${estimatedReadTime} min read</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${sectionGroups.length > 1 ? `
                <!-- Table of Contents -->
                <tr>
                  <td style="padding: 0 32px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.cardBg}; border-radius: 8px; border: 1px solid ${colors.border};">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: ${colors.textSecondary}; text-transform: uppercase; letter-spacing: 0.8px;">In this issue</p>
                          ${sectionGroups.map((group) => `
                            <p style="margin: 0 0 8px 0; font-size: 15px; line-height: 1.6;">
                              <a href="#section-${group.sections[0].index}" style="color: ${colors.primary}; text-decoration: none; font-weight: 600;">
                                ${group.emoji} ${group.name}
                                <span style="color: ${colors.textMuted}; font-weight: 400; font-size: 13px;"> (${group.sections.length})</span>
                              </a>
                            </p>
                          `).join('')}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}

                <!-- Divider -->
                <tr>
                  <td style="padding: 0 32px;">
                    <hr style="margin: 0 0 16px 0; border: 0; border-top: 2px solid ${colors.border};">
                  </td>
                </tr>

                <!-- Content Sections (organized by category) -->
                ${sectionGroups.map((group, groupIndex) => `
                  <!-- Section Group: ${group.name} -->
                  <tr>
                    <td style="padding: ${groupIndex === 0 ? '16px' : '32px'} 32px 16px;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background-color: ${colors.text}; border-radius: 4px; padding: 6px 14px;">
                            <span style="font-size: 12px; font-weight: 700; color: ${colors.white}; text-transform: uppercase; letter-spacing: 1px;">${group.emoji} ${group.name}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  ${group.sections.map((section, sectionIndex) => {
                    const categoryColor = categoryColors[section.index % categoryColors.length]
                    const hasTakeaways = section.takeaways && section.takeaways.length > 0
                    const hasLede = section.lede && section.lede.length > 0
                    const hasTitle = section.title && section.title.length > 0

                    return `
                  <tr id="${generateAnchorId(section.headline, section.index)}">
                    <td style="padding: 0 32px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding: 20px 0 24px;">
                            <!-- Content type pill and author badge -->
                            <table cellpadding="0" cellspacing="0" style="margin-bottom: 14px;">
                              <tr>
                                ${section.content_type_label ? `
                                <td style="background-color: ${categoryColor}; border-radius: 4px; padding: 5px 11px; margin-right: 8px;">
                                  <span style="font-size: 10px; font-weight: 700; color: ${colors.white}; text-transform: uppercase; letter-spacing: 0.8px;">${section.content_type_emoji || section.emoji} ${section.content_type_label}</span>
                                </td>
                                ` : ''}
                                ${section.author_username ? `
                                <td style="width: 8px;"></td>
                                <td style="border: 1.5px solid ${categoryColor}; border-radius: 4px; padding: 4px 10px;">
                                  <span style="font-size: 10px; font-weight: 600; color: ${categoryColor}; text-transform: uppercase; letter-spacing: 0.5px;">@${section.author_username}</span>
                                </td>
                                ` : ''}
                              </tr>
                            </table>

                            <!-- Title (new editorial format) -->
                            ${hasTitle ? `
                            <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: ${colors.text}; line-height: 1.3;">${section.title}</h2>
                            ` : `
                            <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: ${colors.text}; line-height: 1.3; text-transform: uppercase; letter-spacing: -0.5px;">${section.headline}</h2>
                            `}

                            <!-- Lede (1-2 sentence summary) -->
                            ${hasLede ? `
                            <p style="margin: 0 0 16px 0; font-size: 17px; color: ${colors.text}; line-height: 1.6; font-weight: 500;">${section.lede}</p>
                            ` : ''}

                            <!-- Body -->
                            <p style="margin: 0 0 ${hasTakeaways ? '16px' : '18px'} 0; font-size: 16px; color: ${colors.textSecondary}; line-height: 1.7;">${section.body}</p>

                            <!-- Takeaways (bullet points) -->
                            ${hasTakeaways ? `
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 18px; background-color: ${colors.cardBg}; border-left: 3px solid ${categoryColor}; border-radius: 0 6px 6px 0;">
                              <tr>
                                <td style="padding: 16px 20px;">
                                  <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: ${colors.textSecondary}; text-transform: uppercase; letter-spacing: 0.8px;">Key Takeaways</p>
                                  ${section.takeaways!.map(takeaway => `
                                    <p style="margin: 0 0 8px 0; font-size: 15px; color: ${colors.text}; line-height: 1.5; padding-left: 0;">
                                      <span style="color: ${categoryColor}; font-weight: 700; margin-right: 8px;">•</span>${takeaway}
                                    </p>
                                  `).join('')}
                                </td>
                              </tr>
                            </table>
                            ` : ''}

                            <!-- Why you saved it (if available) -->
                            ${section.why_you_saved_it ? `
                            <p style="margin: 0 0 16px 0; font-size: 14px; color: ${colors.textMuted}; line-height: 1.6; font-style: italic;">💭 ${section.why_you_saved_it}</p>
                            ` : ''}

                            <!-- CTA Button (enhanced) -->
                            <table cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="background-color: ${colors.primary}; border-radius: 6px; padding: 12px 20px;">
                                  <a href="${section.instagram_url}" style="display: block; font-size: 14px; font-weight: 600; color: ${colors.white}; text-decoration: none; text-align: center;">View on Instagram &rarr;</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      ${sectionIndex < group.sections.length - 1 || groupIndex < sectionGroups.length - 1 ? `<hr style="margin: 0; border: 0; border-top: 1px solid ${colors.border};">` : ''}
                    </td>
                  </tr>
                  `}).join('')}
                `).join('')}

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
