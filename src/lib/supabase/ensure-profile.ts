import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Ensures a user profile exists in the `users` table.
 * If the profile doesn't exist (e.g. user signed up before the DB trigger was created),
 * creates one with default values.
 */
export async function ensureUserProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  email: string
) {
  // Try to fetch the existing profile
  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (existing) {
    return existing
  }

  // Profile doesn't exist — create it
  // Use the admin client if available, otherwise try with the current client
  const { data: created, error: insertError } = await supabase
    .from('users')
    .upsert({
      id: userId,
      email,
    })
    .select()
    .single()

  if (insertError) {
    console.error('Failed to create user profile:', insertError)
    return null
  }

  return created
}
