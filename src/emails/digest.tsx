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
<body style="margin: 0; padding: 0; background-color: #f9f5f0; font-family: 'Georgia', 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f5f0;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

          <!-- Top bar -->
          <tr>
            <td style="padding: 16px 24px; text-align: center;">
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #999999; text-transform: uppercase; letter-spacing: 1.5px;">
                ${date}
              </p>
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 0 24px 24px 24px; text-align: center; border-bottom: 4px solid #E4405F;">
              <h1 style="margin: 0 0 6px 0; font-size: 36px; font-weight: 700; color: #1a1a1a; font-family: 'Georgia', 'Times New Roman', serif;">urdigest</h1>
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #666666;">
                Your ${posts.length} saved ${posts.length === 1 ? 'post' : 'posts'}, summarized.
              </p>
            </td>
          </tr>

          <!-- Main content area -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 0 0 8px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Greeting -->
                <tr>
                  <td style="padding: 32px 32px 24px 32px;">
                    <p style="margin: 0; font-size: 17px; color: #333333; line-height: 1.7;">
                      Good morning! Here's what you saved on Instagram yesterday, with quick summaries so you can catch up fast.
                    </p>
                  </td>
                </tr>

                <!-- Posts -->
                ${posts.map((post, index) => `
                <tr>
                  <td style="padding: 0 32px;">
                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0 24px 0;">
                          <div style="border-top: 1px solid #e5e5e5;"></div>
                        </td>
                      </tr>
                    </table>

                    <!-- Post number badge -->
                    <table cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                      <tr>
                        <td style="background-color: #E4405F; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.5px;">
                          ${index + 1} of ${posts.length}${post.author_username ? ` &middot; @${post.author_username}` : ''}
                        </td>
                      </tr>
                    </table>

                    <!-- Title -->
                    <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #1a1a1a; line-height: 1.3; font-family: 'Georgia', 'Times New Roman', serif;">
                      ${post.title}
                    </h2>

                    ${post.thumbnail_url ? `
                    <!-- Thumbnail -->
                    <img src="${post.thumbnail_url}" alt="" style="width: 100%; height: auto; border-radius: 6px; margin-bottom: 16px;">
                    ` : ''}

                    <!-- Summary -->
                    <p style="margin: 0 0 16px 0; font-size: 16px; color: #444444; line-height: 1.7;">
                      ${post.summary}
                    </p>

                    <!-- CTA link -->
                    <p style="margin: 0 0 8px 0;">
                      <a href="${post.instagram_url}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #E4405F; text-decoration: none; font-weight: 600;">View original post &rarr;</a>
                    </p>
                  </td>
                </tr>
                `).join('')}

                <!-- Bottom divider -->
                <tr>
                  <td style="padding: 24px 32px 0 32px;">
                    <div style="border-top: 1px solid #e5e5e5;"></div>
                  </td>
                </tr>

                <!-- Footer CTA -->
                <tr>
                  <td style="padding: 24px 32px 32px 32px; text-align: center;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; color: #666666; line-height: 1.6;">
                      Save more posts by sharing them to urdigest on Instagram.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #999999;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings" style="color: #999999; text-decoration: underline;">Preferences</a>
                &nbsp;&middot;&nbsp;
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe" style="color: #999999; text-decoration: underline;">Unsubscribe</a>
              </p>
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #bbbbbb;">
                Made with care by urdigest
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
