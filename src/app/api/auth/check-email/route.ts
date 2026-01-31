import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check if user exists in users table
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, instagram_user_id, password_set_at')
      .eq('email', email.toLowerCase())
      .single()

    if (error || !user) {
      return NextResponse.json({ exists: false })
    }

    // Check if user needs password setup
    // If they have instagram_user_id but no password_set_at, they need to set password
    // If password_set_at exists, they've already set their password
    const needsPasswordSetup = !!user.instagram_user_id && !user.password_set_at

    return NextResponse.json({
      exists: true,
      needsPasswordSetup,
      userId: user.id,
    })
  } catch (error) {
    console.error('Error checking email:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
