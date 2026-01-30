/**
 * Send a DM to an Instagram user via the Instagram Messaging API.
 * Requires INSTAGRAM_ACCESS_TOKEN env var (a long-lived page access token).
 */
export async function sendInstagramMessage(recipientId: string, text: string): Promise<boolean> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!accessToken) {
    console.error('INSTAGRAM_ACCESS_TOKEN not configured')
    return false
  }

  try {
    const response = await fetch(
      `https://graph.instagram.com/v21.0/me/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
          access_token: accessToken,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('Failed to send Instagram message:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending Instagram message:', error)
    return false
  }
}
