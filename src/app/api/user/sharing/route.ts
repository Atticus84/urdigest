import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const SharingSettingsSchema = z.object({
  digest_name: z.string().max(100).optional(),
  digest_description: z.string().max(500).optional(),
  follow_slug: z.string().min(3).max(60).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only (no leading/trailing hyphens)',
  }).optional(),
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
      .select('digest_name, digest_description, follow_slug, sharing_enabled, follower_count')
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

    // If slug is being set, check uniqueness
    if (settings.follow_slug) {
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('follow_slug', settings.follow_slug)
        .neq('id', user.id)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'This URL slug is already taken' },
          { status: 409 }
        )
      }
    }

    const { data: updated, error } = await supabaseAdmin
      .from('users')
      .update(settings)
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
