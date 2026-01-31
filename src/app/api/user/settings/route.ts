import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureUserProfileServer } from '@/lib/supabase/ensure-profile-server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const SettingsSchema = z.object({
  digest_time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  timezone: z.string().optional(),
  digest_enabled: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Ensure user profile exists
    await ensureUserProfileServer(user.id, user.email!)

    // Parse and validate request body
    const body = await request.json()
    const settings = SettingsSchema.parse(body)

    // Update user settings using admin client to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(settings)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Update settings error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
