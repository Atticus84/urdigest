/**
 * Send a DM to an Instagram user via the Instagram Messaging API.
 * Requires INSTAGRAM_ACCESS_TOKEN env var (a long-lived page access token).
 * Also requires INSTAGRAM_PAGE_ID env var (the Facebook Page ID connected to Instagram).
 */
export async function sendInstagramMessage(recipientId: string, text: string): Promise<boolean> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const pageId = process.env.INSTAGRAM_PAGE_ID || 'me' // Fallback to 'me' if not set
  
  if (!accessToken) {
    console.error('INSTAGRAM_ACCESS_TOKEN not configured')
    return false
  }

  if (!text || text.trim().length === 0) {
    console.error('Cannot send empty message')
    return false
  }

  // Use graph.facebook.com for messaging API (not graph.instagram.com)
  const url = `https://graph.facebook.com/v21.0/${pageId}/messages`
  
  const payload = {
    recipient: { id: recipientId },
    message: { text: text.trim() },
    messaging_type: 'RESPONSE', // Required for responding to user messages
  }

  console.log(`Attempting to send Instagram message to ${recipientId} via ${url}`)

  try {
    const response = await fetch(
      `${url}?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    const responseData = await response.json()

    if (!response.ok) {
      console.error('❌ Failed to send Instagram message:', {
        status: response.status,
        statusText: response.statusText,
        error: responseData,
        errorCode: responseData.error?.code,
        errorMessage: responseData.error?.message,
        errorType: responseData.error?.type,
        errorSubcode: responseData.error?.error_subcode,
        recipientId,
        url,
        accessTokenPresent: !!accessToken,
        accessTokenLength: accessToken?.length,
      })
      
      // Common error messages
      if (responseData.error?.code === 10) {
        console.error('⚠️  Error 10: App is in Development Mode. Webhooks only work for users with roles on your app.')
      }
      if (responseData.error?.code === 200) {
        console.error('⚠️  Error 200: Permission denied. Check that your access token has instagram_manage_messages permission.')
      }
      if (responseData.error?.code === 190) {
        console.error('⚠️  Error 190: Invalid access token. Token may be expired or invalid.')
      }
      
      return false
    }

    console.log('Instagram message sent successfully:', {
      recipientId,
      messageId: responseData.message_id,
    })
    return true
  } catch (error) {
    console.error('Error sending Instagram message:', {
      error: error instanceof Error ? error.message : String(error),
      recipientId,
      url,
    })
    return false
  }
}
