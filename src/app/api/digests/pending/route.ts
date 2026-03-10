import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SavedPost } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get ALL unprocessed posts that would be included in the next digest
    const { data: posts, error } = await supabase
      .from('saved_posts')
      .select('*')
      .eq('user_id', user.id)
      .eq('processed', false)
      .order('saved_at', { ascending: false })

    if (error) {
      console.error('Error fetching pending posts:', error)
      return NextResponse.json({ error: 'Failed to fetch pending posts' }, { status: 500 })
    }

    return NextResponse.json({ posts: posts || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
