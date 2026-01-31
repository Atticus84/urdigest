import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Find the user by email in users table
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update the auth user's email to match
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { email: user.email }
    )

    if (updateError) {
      console.error('Error updating auth email:', updateError)
      return NextResponse.json({ error: 'Failed to update email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Email updated in auth system' })
  } catch (error) {
    console.error('Error fixing email:', error)
    return NextResponse.json({ error: 'Failed to fix email' }, { status: 500 })
  }
}
