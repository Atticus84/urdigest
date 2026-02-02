import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET - fetch the user's Instagram followers/following
// Note: Instagram Basic Display API and Graph API have limited access to followers.
// We use the Instagram Graph API for business/creator accounts.
// For personal accounts, this will return the user's own info only.
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('instagram_user_id, instagram_username')
      .eq('id', user.id)
      .single()

    if (!profile?.instagram_user_id) {
      return NextResponse.json({
        connected: false,
        username: null,
        followers: [],
      })
    }

    // Instagram Graph API doesn't expose individual follower lists for most apps.
    // What we CAN do: get the user's follower count and use the messaging API
    // to send DMs to users who have messaged us (conversation participants).
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({
        connected: true,
        username: profile.instagram_username,
        followers: [],
        error: 'Instagram API not configured',
      })
    }

    // Fetch conversations — these are people who have DM'd the account
    // This is the only reliable way to get sendable Instagram user IDs
    const pageId = process.env.INSTAGRAM_PAGE_ID || 'me'
    const convoUrl = `https://graph.facebook.com/v21.0/${pageId}/conversations?fields=participants,updated_time&limit=50&access_token=${accessToken}`

    let contacts: { id: string; username: string }[] = []
    try {
      const res = await fetch(convoUrl)
      if (res.ok) {
        const data = await res.json()
        const seen = new Set<string>()
        for (const convo of data.data || []) {
          for (const p of convo.participants?.data || []) {
            // Skip our own account
            if (p.id === profile.instagram_user_id) continue
            if (p.id === pageId) continue
            if (seen.has(p.id)) continue
            seen.add(p.id)
            contacts.push({
              id: p.id,
              username: p.username || p.name || p.id,
            })
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch Instagram conversations:', e)
    }

    return NextResponse.json({
      connected: true,
      username: profile.instagram_username,
      contacts,
    })
  } catch (error) {
    console.error('Instagram connections error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
