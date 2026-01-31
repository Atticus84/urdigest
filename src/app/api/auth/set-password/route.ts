import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Find the user by email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get the correct email from users table
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single()

    // Update the user's password AND email (in case auth email is still placeholder)
    const updateData: { password: string; email?: string } = { password }
    if (userData?.email) {
      updateData.email = userData.email
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      updateData
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      return NextResponse.json({ error: 'Failed to set password' }, { status: 500 })
    }

    // Mark that password has been set
    await supabaseAdmin
      .from('users')
      .update({ password_set_at: new Date().toISOString() })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error setting password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
