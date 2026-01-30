interface PostSummary {
  id: string
  title: string
  summary: string
  instagram_url: string
  thumbnail_url: string | null
  author_username: string | null
}

interface DigestEmailProps {
  posts: PostSummary[]
  userEmail: string
  date: string
}

export function DigestEmail({
  posts,
  userEmail,
  date,
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

                <a href="${post.instagram_url}" style="display: inline-block; padding: 12px 24px; background-color: #E4405F; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">View on Instagram →</a>

                ${index < posts.length - 1 ? '<hr style="margin: 32px 0; border: 0; border-top: 1px solid #eaeaea;">' : ''}
              `).join('')}
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
