import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { enrichInstagramPosts, enrichPendingPosts } from '@/lib/content-extraction/enrich'

/**
 * POST /api/jobs/saved-posts/process-batch
 *
 * Process multiple saved posts to extract transcripts, generate summaries, and/or extract OCR
 *
 * Query params (optional):
 * - limit: Max number of posts to process (default: 50)
 * - concurrent: Max concurrent processing (default: 1)
 * - unprocessedOnly: Only process posts with processing_status='pending' (default: true)
 * - postType: Filter by post type ('video', 'photo', 'reel', etc.)
 *
 * Request body (optional):
 * - postIds: Array of specific post IDs to process
 *
 * Examples:
 * - POST /api/jobs/saved-posts/process-batch?limit=10 - Process 10 pending posts
 * - POST /api/jobs/saved-posts/process-batch?unprocessedOnly=false&limit=5 - Process any 5 posts
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const concurrent = parseInt(searchParams.get('concurrent') || '1')
    const unprocessedOnly = searchParams.get('unprocessedOnly') !== 'false'
    const postType = searchParams.get('postType') // e.g., 'video', 'reel'
    const includeProcessed = searchParams.get('includeProcessed') === 'true'

    console.log(`[API Batch] Processing batch - limit: ${limit}, concurrent: ${concurrent}`)
    console.log(`[API Batch] Unprocessed only: ${unprocessedOnly}, Post type: ${postType || 'all'}`)

    let postsToProcess = []

    // Check if specific post IDs were provided
    let body: any = null
    if (req.method === 'POST' && req.body) {
      try {
        body = await req.json()
      } catch {
        // Body parsing failed, ignore
      }
    }

    if (body?.postIds && Array.isArray(body.postIds) && body.postIds.length > 0) {
      // Process specific posts
      console.log(`[API Batch] Processing ${body.postIds.length} specific posts`)

      let query = supabaseAdmin
        .from('saved_posts')
        .select('*')
        .in('id', body.postIds)
        .limit(limit)

      const { data, error } = await query

      if (error) {
        throw new Error(`Failed to fetch posts: ${error.message}`)
      }

      postsToProcess = data || []
    } else {
      // Get unprocessed posts based on filters
      let query = supabaseAdmin.from('saved_posts').select('*')

      // Filter by processing status
      if (unprocessedOnly) {
        query = query.eq('processing_status', 'pending')
      } else if (!includeProcessed) {
        // If not unprocessedOnly and not includeProcessed, get posts that haven't been enriched yet
        query = query.in('processing_status', ['pending', 'enriching'])
      }

      // Filter by post type if specified
      if (postType) {
        query = query.eq('post_type', postType)
      }

      query = query.limit(limit)

      const { data, error } = await query

      if (error) {
        throw new Error(`Failed to fetch posts: ${error.message}`)
      }

      postsToProcess = data || []
    }

    if (!postsToProcess || postsToProcess.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No posts to process',
          processed: 0,
          results: [],
        },
        { status: 200 }
      )
    }

    console.log(`[API Batch] Found ${postsToProcess.length} posts to process`)

    // Enrich all posts
    const enrichmentResults = await enrichInstagramPosts(postsToProcess, {
      concurrent,
    })

    // Prepare response
    const successCount = enrichmentResults.filter((r) => r.success).length
    const transcriptCount = enrichmentResults.filter((r) => r.transcriptExtracted).length
    const summaryCount = enrichmentResults.filter((r) => r.transcriptSummary).length
    const ocrCount = enrichmentResults.filter((r) => r.ocrExtracted).length

    const results = enrichmentResults.map((r) => ({
      postId: r.postId,
      success: r.success,
      transcriptExtracted: r.transcriptExtracted,
      transcriptLength: r.transcriptText?.length ?? 0,
      summaryGenerated: !!r.transcriptSummary,
      summaryPreview: r.transcriptSummary
        ? r.transcriptSummary.substring(0, 100) + '...'
        : null,
      ocrExtracted: r.ocrExtracted,
      ocrLength: r.ocrText?.length ?? 0,
      confidence: r.confidence,
      processingTimeSeconds: r.processingTimeSeconds,
      error: r.error,
    }))

    return NextResponse.json(
      {
        success: true,
        processed: postsToProcess.length,
        successful: successCount,
        failed: postsToProcess.length - successCount,
        stats: {
          transcriptExtracted: transcriptCount,
          summariesGenerated: summaryCount,
          ocrExtracted: ocrCount,
        },
        results,
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[API Batch] Error:`, message)

    return NextResponse.json(
      { error: 'Failed to process batch', details: message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/jobs/saved-posts/process-batch
 *
 * Get status and stats of pending posts
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const includeStats = searchParams.get('stats') === 'true'

    // Get count of pending posts
    const { count: pendingCount, error: pendingError } = await supabaseAdmin
      .from('saved_posts')
      .select('*', { count: 'exact', head: true })
      .eq('processing_status', 'pending')

    if (pendingError) {
      throw pendingError
    }

    // Get count of completed posts
    const { count: completedCount, error: completedError } = await supabaseAdmin
      .from('saved_posts')
      .select('*', { count: 'exact', head: true })
      .eq('processing_status', 'completed')

    if (completedError) {
      throw completedError
    }

    // Get count with transcripts
    const { count: withTranscriptCount, error: transcriptError } = await supabaseAdmin
      .from('saved_posts')
      .select('*', { count: 'exact', head: true })
      .not('transcript_text', 'is', null)

    if (transcriptError) {
      throw transcriptError
    }

    // Get count with summaries
    const { count: withSummaryCount, error: summaryError } = await supabaseAdmin
      .from('saved_posts')
      .select('*', { count: 'exact', head: true })
      .not('transcript_summary', 'is', null)

    if (summaryError) {
      throw summaryError
    }

    // Get count with OCR
    const { count: withOcrCount, error: ocrError } = await supabaseAdmin
      .from('saved_posts')
      .select('*', { count: 'exact', head: true })
      .not('ocr_text', 'is', null)

    if (ocrError) {
      throw ocrError
    }

    return NextResponse.json(
      {
        status: 'ready',
        pending: pendingCount || 0,
        completed: completedCount || 0,
        ...(includeStats && {
          stats: {
            postsWithTranscripts: withTranscriptCount || 0,
            postsWithSummaries: withSummaryCount || 0,
            postsWithOcr: withOcrCount || 0,
          },
        }),
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[API] Error fetching batch status:`, message)

    return NextResponse.json(
      { error: 'Failed to fetch status', details: message },
      { status: 500 }
    )
  }
}
