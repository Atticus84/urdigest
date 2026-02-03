import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const SharingSettingsSchema = z.object({
  digest_name: z.string().max(100).nullable().optional(),
  digest_description: z.string().max(500).nullable().optional(),
  follow_slug: z.string().min(3).max(60).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only (no leading/trailing hyphens)',
  }).nullable().optional(),
  sharing_enabled: z.boolean().optional(),
})

// GET - get sharing settings
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('digest_name, digest_description, follow_slug, sharing_enabled, follower_count, instagram_username')
      .eq('id', user.id)
      .single()

    if (error) throw error

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Get sharing settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - update sharing settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const settings = SharingSettingsSchema.parse(body)

    // Build update object
    const update: Record<string, any> = {}
    if (settings.sharing_enabled !== undefined) update.sharing_enabled = settings.sharing_enabled
    if (settings.digest_name !== undefined) update.digest_name = settings.digest_name || null
    if (settings.digest_description !== undefined) update.digest_description = settings.digest_description || null
    if (settings.follow_slug !== undefined) {
      const slug = settings.follow_slug
      if (slug) {
        // Check uniqueness
        const { data: existing } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('follow_slug', slug)
          .neq('id', user.id)
          .single()

        if (existing) {
          return NextResponse.json(
            { error: 'This URL slug is already taken' },
            { status: 409 }
          )
        }
      }
      update.follow_slug = slug || null
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: updated, error } = await supabaseAdmin
      .from('users')
      .update(update)
      .eq('id', user.id)
      .select('digest_name, digest_description, follow_slug, sharing_enabled, follower_count')
      .single()

    if (error) throw error

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Update sharing settings error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
