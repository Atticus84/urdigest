import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const query = (url.searchParams.get('q') || '').slice(0, 500)
    const postType = url.searchParams.get('type') || ''
    const author = url.searchParams.get('author') || ''
    const status = url.searchParams.get('status') || '' // pending | digested | enriched
    const sortBy = url.searchParams.get('sort') || 'saved_at'
    const sortDir = url.searchParams.get('dir') || 'desc'
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '24', 10) || 24), 100)
    const offset = (page - 1) * limit

    // Build query
    let dbQuery = supabase
      .from('saved_posts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    // Full-text search across caption, transcript, ocr, author
    if (query.trim()) {
      // Use Supabase ilike for search across multiple columns
      const searchTerm = `%${query.trim()}%`
      dbQuery = dbQuery.or(
        `caption.ilike.${searchTerm},transcript_text.ilike.${searchTerm},transcript_summary.ilike.${searchTerm},ocr_text.ilike.${searchTerm},author_username.ilike.${searchTerm}`
      )
    }

    // Filter by post type
    if (postType) {
      dbQuery = dbQuery.eq('post_type', postType)
    }

    // Filter by author
    if (author) {
      dbQuery = dbQuery.eq('author_username', author)
    }

    // Filter by processing status
    if (status === 'pending') {
      dbQuery = dbQuery.eq('processed', false)
    } else if (status === 'digested') {
      dbQuery = dbQuery.eq('processed', true)
    } else if (status === 'enriched') {
      dbQuery = dbQuery.eq('processing_status', 'completed')
    }

    // Sort
    const validSorts = ['saved_at', 'created_at', 'posted_at', 'author_username']
    const sortColumn = validSorts.includes(sortBy) ? sortBy : 'saved_at'
    dbQuery = dbQuery.order(sortColumn, { ascending: sortDir === 'asc' })

    // Paginate
    dbQuery = dbQuery.range(offset, offset + limit - 1)

    const { data: posts, error, count } = await dbQuery

    if (error) {
      throw new Error(`Search failed: ${error.message}`)
    }

    // Get unique authors for filter dropdown
    const { data: authors } = await supabase
      .from('saved_posts')
      .select('author_username')
      .eq('user_id', user.id)
      .not('author_username', 'is', null)

    const uniqueAuthors = [...new Set((authors || []).map(a => a.author_username).filter(Boolean))]

    // Get post type counts for filter badges
    const { data: typeCounts } = await supabase
      .from('saved_posts')
      .select('post_type')
      .eq('user_id', user.id)

    const typeBreakdown: Record<string, number> = {}
    for (const row of typeCounts || []) {
      const t = row.post_type || 'unknown'
      typeBreakdown[t] = (typeBreakdown[t] || 0) + 1
    }

    return NextResponse.json({
      posts: posts || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      authors: uniqueAuthors,
      typeBreakdown,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
