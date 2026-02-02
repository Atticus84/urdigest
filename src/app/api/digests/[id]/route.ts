import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: digest, error } = await supabase
      .from('digests')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !digest) {
      return NextResponse.json({ error: 'Digest not found' }, { status: 404 })
    }

    // Also fetch the associated posts
    let posts: any[] = []
    if (digest.post_ids && digest.post_ids.length > 0) {
      const { data: postData } = await supabase
        .from('saved_posts')
        .select('*')
        .in('id', digest.post_ids)

      posts = postData || []
    }

    return NextResponse.json({ digest, posts })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
