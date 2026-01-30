import { supabaseAdmin } from './admin'

/**
 * Server-side: ensures a user profile exists in the `users` table.
 * Uses the admin client (bypasses RLS) so it always works.
 */
export async function ensureUserProfileServer(userId: string, email: string) {
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (existing) {
    return existing
  }

  const { data: created, error } = await supabaseAdmin
    .from('users')
    .upsert({ id: userId, email })
    .select()
    .single()

  if (error) {
    console.error('Failed to create user profile (admin):', error)
    return null
  }

  return created
}
