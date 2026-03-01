import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { enrichInstagramPost, enrichInstagramPosts, enrichPendingPosts } from '@/lib/content-extraction/enrich'

/**
 * POST /api/jobs/saved-posts/process-one
 *
 * Process a single saved post to extract transcript, generate summary, and/or extract OCR
 *
 * Query params:
 * - id: The post ID to process
 *
 * Request body (optional):
 * - postId: Alternative to query param
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    let postId = searchParams.get('id')

    // Also check request body
    if (!postId && req.body) {
      try {
        const body = await req.json()
        postId = body.postId || body.id
      } catch {
        // Body parsing failed, ignore
      }
    }

    if (!postId) {
      return NextResponse.json(
        { error: 'Missing postId parameter' },
        { status: 400 }
      )
    }

    console.log(`[API] Processing single post: ${postId}`)

    // Fetch the post
    const { data: post, error: fetchError } = await supabaseAdmin
      .from('saved_posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (fetchError || !post) {
      console.error(`[API] Post not found:`, fetchError)
      return NextResponse.json(
        { error: 'Post not found', details: fetchError?.message },
        { status: 404 }
      )
    }

    console.log(`[API] Found post: ${post.instagram_url}`)
    console.log(`[API] Post type: ${post.post_type}`)

    // Enrich the post
    const result = await enrichInstagramPost(post)

    return NextResponse.json(
      {
        success: result.success,
        postId: result.postId,
        transcriptExtracted: result.transcriptExtracted,
        transcriptLength: result.transcriptText?.length ?? 0,
        summaryGenerated: !!result.transcriptSummary,
        summaryPreview: result.transcriptSummary
          ? result.transcriptSummary.substring(0, 150) + '...'
          : null,
        ocrExtracted: result.ocrExtracted,
        ocrLength: result.ocrText?.length ?? 0,
        confidence: result.confidence,
        processingTimeSeconds: result.processingTimeSeconds,
        sourcesUsed: result.sourcesUsed,
        error: result.error,
      },
      { status: result.success ? 200 : 400 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[API] Error processing single post:`, message)

    return NextResponse.json(
      { error: 'Failed to process post', details: message },
      { status: 500 }
    )
  }
}
