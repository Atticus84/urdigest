import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: digests, error } = await supabase
    .from('digests')
    .select('id, subject, summary, post_count, sent_at')
    .eq('user_id', user.id)
    .order('sent_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch digests' }, { status: 500 })
  }

  return NextResponse.json({ digests: digests || [] })
}
