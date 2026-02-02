import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: digests, error } = await supabase
      .from('digests')
      .select('id, subject, summary, post_count, sent_at, opened_at, created_at')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching digests:', error)
      return NextResponse.json({ error: 'Failed to fetch digests' }, { status: 500 })
    }

    return NextResponse.json({ digests: digests || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
