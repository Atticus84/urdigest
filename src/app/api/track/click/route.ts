import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET /api/track/click?d=digestId&p=postId&u=userId&url=encodedUrl
// Records a click then redirects to the actual URL
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const digestId = params.get('d')
  const postId = params.get('p')
  const userId = params.get('u')
  const targetUrl = params.get('url')

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Record the click asynchronously — don't block the redirect
  if (digestId && userId) {
    supabaseAdmin
      .from('digest_clicks')
      .insert({
        digest_id: digestId,
        user_id: userId,
        post_id: postId || null,
      })
      .then(({ error }: { error: unknown }) => {
        if (error) console.error('Failed to record click:', error)
      })
  }

  return NextResponse.redirect(targetUrl, 302)
}
