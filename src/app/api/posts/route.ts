import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const processedFilter = searchParams.get('processed')

    // Build query
    let query = supabase
      .from('saved_posts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (processedFilter !== null) {
      query = query.eq('processed', processedFilter === 'true')
    }

    const { data: posts, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      posts: posts || [],
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    })
  } catch (error) {
    console.error('Get posts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
