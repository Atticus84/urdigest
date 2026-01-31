import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { identifier } = await request.json() // Can be email or Instagram username

    if (!identifier) {
      return NextResponse.json({ error: 'Email or Instagram username is required' }, { status: 400 })
    }

    const identifierLower = identifier.toLowerCase().trim()
    
    // Remove @ if user included it for Instagram username
    const cleanIdentifier = identifierLower.startsWith('@') 
      ? identifierLower.slice(1) 
      : identifierLower

    // Check if it's an email (contains @) or Instagram username
    const isEmail = cleanIdentifier.includes('@')

    let user
    let error

    if (isEmail) {
      // Search by email
      const result = await supabaseAdmin
        .from('users')
        .select('id, email, instagram_username, instagram_user_id, password_set_at')
        .eq('email', cleanIdentifier)
        .single()
      
      user = result.data
      error = result.error
    } else {
      // Search by Instagram username
      const result = await supabaseAdmin
        .from('users')
        .select('id, email, instagram_username, instagram_user_id, password_set_at')
        .eq('instagram_username', cleanIdentifier)
        .single()
      
      user = result.data
      error = result.error
    }

    if (error || !user) {
      return NextResponse.json({ 
        exists: false,
        error: isEmail 
          ? 'No account found with this email' 
          : 'No account found with this Instagram username'
      })
    }

    // Check if user needs password setup
    // If they have instagram_user_id but no password_set_at, they need to set password
    // If password_set_at exists, they've already set their password
    const needsPasswordSetup = !!user.instagram_user_id && !user.password_set_at

    return NextResponse.json({
      exists: true,
      needsPasswordSetup,
      userId: user.id,
      email: user.email, // Return email for login
      instagramUsername: user.instagram_username,
    })
  } catch (error) {
    console.error('Error checking identifier:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
