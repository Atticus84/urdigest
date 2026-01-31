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
      .select('id, email, instagram_user_id')
      .eq('email', email.toLowerCase())
      .single()

    if (error || !user) {
      return NextResponse.json({ exists: false })
    }

    // Check if auth user exists and has a password set
    // We can't directly check if password is set, but we can check if they can authenticate
    // For now, we'll assume if they have an instagram_user_id, they likely need to set a password
    // (since DM users get random passwords)
    const needsPasswordSetup = !!user.instagram_user_id

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
