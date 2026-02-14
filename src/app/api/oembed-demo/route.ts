import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const INSTAGRAM_URL_PATTERN =
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[\w-]+/

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = request.nextUrl.searchParams.get('url')
    if (!url) {
      return NextResponse.json(
        { error: 'Missing required "url" query parameter' },
        { status: 400 }
      )
    }

    if (!INSTAGRAM_URL_PATTERN.test(url)) {
      return NextResponse.json(
        { error: 'Invalid Instagram URL. Provide a link to a post, reel, or IGTV video.' },
        { status: 400 }
      )
    }

    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Instagram API is not configured on this server' },
        { status: 503 }
      )
    }

    const oembedUrl = new URL('https://graph.facebook.com/v21.0/instagram_oembed')
    oembedUrl.searchParams.set('url', url)
    oembedUrl.searchParams.set('access_token', accessToken)
    oembedUrl.searchParams.set('omitscript', 'true')

    const response = await fetch(oembedUrl.toString())

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Instagram oEmbed API error:', response.status, errorBody)
      return NextResponse.json(
        { error: 'Failed to fetch oEmbed data from Instagram' },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('oEmbed demo error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
