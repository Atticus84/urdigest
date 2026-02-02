import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const pageId = process.env.INSTAGRAM_PAGE_ID || 'me'

  if (!accessToken) {
    return NextResponse.json({
      valid: false,
      error: 'INSTAGRAM_ACCESS_TOKEN not set'
    })
  }

  try {
    // Test the token by calling the debug_token endpoint or a simple /me call
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=id,name,access_token&access_token=${accessToken}`
    )
    const data = await response.json()

    if (data.error) {
      return NextResponse.json({
        valid: false,
        error: data.error.message,
        errorCode: data.error.code,
        errorSubcode: data.error.error_subcode,
        hint: data.error.code === 190
          ? 'Token is expired or invalid. Generate a new long-lived Page Access Token.'
          : undefined,
        tokenPrefix: accessToken.substring(0, 4),
        tokenLength: accessToken.length,
      })
    }

    return NextResponse.json({
      valid: true,
      pageId: data.id,
      pageName: data.name,
      tokenPrefix: accessToken.substring(0, 4),
      tokenLength: accessToken.length,
    })
  } catch (error) {
    return NextResponse.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Network error',
    })
  }
}
