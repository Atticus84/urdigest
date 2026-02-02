import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { sendFollowerConfirmationEmail } from '@/lib/email/send'

export const dynamic = 'force-dynamic'

const AddFollowersSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(20),
  note: z.string().max(500).optional(),
})

// GET - list followers for current user
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: followers, error } = await supabaseAdmin
      .from('digest_followers')
      .select('*')
      .eq('user_id', user.id)
      .is('unsubscribed_at', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ followers: followers || [] })
  } catch (error) {
    console.error('Get followers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - add followers (manual invite)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { emails, note } = AddFollowersSchema.parse(body)

    // Get user profile for the digest name
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('email, digest_name, instagram_username')
      .eq('id', user.id)
      .single()

    const digestName = profile?.digest_name || `${profile?.instagram_username || profile?.email}'s digest`

    // Rate limit: max 50 followers total
    const { count } = await supabaseAdmin
      .from('digest_followers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('unsubscribed_at', null)

    if (count !== null && count + emails.length > 50) {
      return NextResponse.json(
        { error: `You can have at most 50 followers. You currently have ${count}.` },
        { status: 400 }
      )
    }

    const added: string[] = []
    const skipped: string[] = []

    for (const email of emails) {
      // Check for existing (including unsubscribed — don't re-add)
      const { data: existing } = await supabaseAdmin
        .from('digest_followers')
        .select('id, unsubscribed_at')
        .eq('user_id', user.id)
        .eq('email', email)
        .single()

      if (existing) {
        if (existing.unsubscribed_at) {
          // Re-subscribe: reset unsubscribed, require re-confirmation
          await supabaseAdmin
            .from('digest_followers')
            .update({
              unsubscribed_at: null,
              confirmed: false,
              confirmed_at: null,
              source: 'manual',
              note: note || null,
            })
            .eq('id', existing.id)
        } else {
          skipped.push(email)
          continue
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('digest_followers')
          .insert({
            user_id: user.id,
            email,
            source: 'manual',
            note: note || null,
          })

        if (insertError) {
          console.error(`Failed to add follower ${email}:`, insertError)
          skipped.push(email)
          continue
        }
      }

      // Get the follower record to send confirmation email
      const { data: follower } = await supabaseAdmin
        .from('digest_followers')
        .select('confirmation_token')
        .eq('user_id', user.id)
        .eq('email', email)
        .single()

      if (follower) {
        await sendFollowerConfirmationEmail(
          email,
          digestName,
          follower.confirmation_token,
          note || undefined
        )
      }

      added.push(email)
    }

    return NextResponse.json({ added, skipped }, { status: 201 })
  } catch (error: any) {
    console.error('Add followers error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - remove a follower
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const followerId = searchParams.get('id')

    if (!followerId) {
      return NextResponse.json({ error: 'Follower ID required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('digest_followers')
      .delete()
      .eq('id', followerId)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete follower error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
