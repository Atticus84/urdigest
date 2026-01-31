interface PostSummary {
  id: string
  title: string
  summary: string
  instagram_url: string
  thumbnail_url: string | null
  author_username: string | null
}

interface AdData {
  image_url?: string | null
  headline: string
  body_text: string
  cta_url: string
  impression_id: string
}

interface DigestEmailProps {
  posts: PostSummary[]
  userEmail: string
  date: string
  userId?: string
  digestId?: string
  ad?: AdData | null
}

function trackUrl(url: string, digestId?: string, postId?: string, userId?: string): string {
  if (!digestId || !userId) return url
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://urdigest.com'
  const params = new URLSearchParams({ d: digestId, u: userId, url })
  if (postId) params.set('p', postId)
  return `${base}/api/track/click?${params.toString()}`
}

export function DigestEmail({
  posts,
  userEmail,
  date,
  userId,
  digestId,
  ad,
}: DigestEmailProps) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your urdigest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 24px; background-color: #fafafa; border-bottom: 1px solid #eaeaea;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #111111;">☀️ Your Daily urdigest</h1>
              <p style="margin: 0; font-size: 16px; color: #666666;">${posts.length} ${posts.length === 1 ? 'post' : 'posts'} you saved on ${date}</p>
            </td>
          </tr>

          <!-- Posts -->
          <tr>
            <td style="padding: 24px;">
              ${posts.map((post, index) => `
                ${post.thumbnail_url ? `
                  <img src="${post.thumbnail_url}" alt="${post.title}" style="width: 100%; height: auto; border-radius: 12px; margin-bottom: 16px;">
                ` : ''}

                <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #111111; line-height: 1.4;">${post.title}</h2>

                <p style="margin: 0 0 12px 0; font-size: 16px; color: #333333; line-height: 1.6;">${post.summary}</p>

                ${post.author_username ? `
                  <p style="margin: 0 0 16px 0; font-size: 14px; color: #999999;">By @${post.author_username}</p>
                ` : ''}

                <a href="${trackUrl(post.instagram_url, digestId, post.id, userId)}" style="display: inline-block; padding: 12px 24px; background-color: #E4405F; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">View on Instagram →</a>

                ${index < posts.length - 1 ? '<hr style="margin: 32px 0; border: 0; border-top: 1px solid #eaeaea;">' : ''}
              `).join('')}

              ${ad ? `
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafafa; border-radius: 12px; border: 1px solid #eaeaea;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 4px 0; font-size: 11px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Sponsored</p>
                          ${ad.image_url ? `<img src="${ad.image_url}" alt="${ad.headline}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 12px;">` : ''}
                          <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #111111;">${ad.headline}</h3>
                          <p style="margin: 0 0 16px 0; font-size: 14px; color: #333333; line-height: 1.5;">${ad.body_text}</p>
                          <a href="${trackUrl(ad.cta_url, digestId, ad.impression_id, userId)}" style="display: inline-block; padding: 10px 20px; background-color: #111111; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Learn More →</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #fafafa; border-top: 1px solid #eaeaea; text-align: center;">
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #666666;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings" style="color: #E4405F; text-decoration: none;">Manage preferences</a>
                ·
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe" style="color: #E4405F; text-decoration: none;">Unsubscribe</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">Made with ❤️ by urdigest</p>
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
