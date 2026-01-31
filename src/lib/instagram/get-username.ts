/**
 * Fetch Instagram username from Instagram Graph API using user ID.
 * Requires INSTAGRAM_ACCESS_TOKEN env var.
 */
export async function getInstagramUsername(userId: string): Promise<string | null> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  
  if (!accessToken) {
    console.error('INSTAGRAM_ACCESS_TOKEN not configured')
    return null
  }

  try {
    // Use Instagram Graph API to get user info
    const url = `https://graph.instagram.com/${userId}?fields=username&access_token=${accessToken}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error(`Failed to fetch Instagram username for ${userId}:`, response.status, response.statusText)
      return null
    }

    const data = await response.json()
    return data.username || null
  } catch (error) {
    console.error(`Error fetching Instagram username for ${userId}:`, error)
    return null
  }
}
