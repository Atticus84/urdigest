import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendInstagramMessage } from '@/lib/instagram/send-message'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const InviteSchema = z.object({
  recipientIds: z.array(z.string()).min(1).max(10),
})

// POST - send Instagram DM invites to follow your digest
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { recipientIds } = InviteSchema.parse(body)

    // Get user profile for the invite message
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('digest_name, follow_slug, sharing_enabled, instagram_username')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const digestName = profile.digest_name || `${profile.instagram_username || 'My'} digest`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const followLink = profile.follow_slug && profile.sharing_enabled
      ? `${appUrl}/f/${profile.follow_slug}`
      : appUrl

    const message = [
      `Hey! I'm sharing a daily digest of the best Instagram posts I save — it's called "${digestName}".`,
      ``,
      `You can follow it and get it in your inbox:`,
      followLink,
      ``,
      `Powered by urdigest.com`,
    ].join('\n')

    const sent: string[] = []
    const failed: string[] = []

    for (const recipientId of recipientIds) {
      const success = await sendInstagramMessage(recipientId, message)
      if (success) {
        sent.push(recipientId)
      } else {
        failed.push(recipientId)
      }
    }

    return NextResponse.json({ sent, failed })
  } catch (error: any) {
    console.error('Instagram invite error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
