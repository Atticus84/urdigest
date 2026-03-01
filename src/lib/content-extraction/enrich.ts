import { supabaseAdmin } from '@/lib/supabase/admin'
import { SavedPost } from '@/types/database'
import { transcribeFromUrl } from './transcribe'
import { extractTextFromImageUrl, extractTextFromMultipleImages } from './ocr'
import { summarizeTranscript } from './summarize-transcript'
import { detectInstagramContentType } from '@/lib/instagram/normalize'

/**
 * Feature flags for content extraction
 */
const ENABLE_TRANSCRIPTION = process.env.ENABLE_TRANSCRIPTION !== 'false' // Default: true
const ENABLE_OCR = process.env.ENABLE_OCR !== 'false' // Default: true
const ENABLE_MEDIA_DOWNLOAD = process.env.ENABLE_MEDIA_DOWNLOAD === 'true' // Default: false (not implemented)

export interface EnrichmentResult {
  postId: string
  success: boolean
  transcriptExtracted: boolean
  ocrExtracted: boolean
  transcriptText: string | null
  transcriptSummary: string | null
  ocrText: string | null
  sourcesUsed: {
    transcript: boolean
    ocr: boolean
    caption: boolean
    metadata: boolean
  }
  confidence: 'low' | 'medium' | 'high'
  error: string | null
  processingTimeSeconds: number
}

/**
 * Calculate confidence based on what sources we have
 */
function calculateEnrichmentConfidence(
  transcriptText: string | null,
  ocrText: string | null,
  caption: string | null,
  author: string | null
): 'low' | 'medium' | 'high' {
  let score = 0

  if (transcriptText && transcriptText.length > 50) score += 5
  else if (transcriptText && transcriptText.length > 0) score += 3

  if (ocrText && ocrText.length > 50) score += 4
  else if (ocrText && ocrText.length > 0) score += 2

  if (caption && caption.length > 20) score += 2
  else if (caption && caption.length > 0) score += 1

  if (author) score += 2

  if (score >= 10) return 'high'
  if (score >= 5) return 'medium'
  return 'low'
}

/**
 * Enrich a single Instagram post with transcript and OCR
 *
 * This is the main enrichment function that:
 * 1. Determines content type (reel/video/carousel/image)
 * 2. Transcribes reels/videos if applicable
 * 3. Runs OCR on images/carousels if applicable
 * 4. Stores results in database
 * 5. Returns structured result with sources used
 *
 * @param post - SavedPost record from database
 * @returns EnrichmentResult with extracted content and metadata
 */
export async function enrichInstagramPost(post: SavedPost): Promise<EnrichmentResult> {
  const startTime = Date.now()

  console.log(`\n[Enrichment] Starting for post ${post.id} (${post.instagram_url})`)

  // Detect content type
  const contentType = detectInstagramContentType(
    post.instagram_url,
    post.post_type,
    post.media_urls
  )

  console.log(`[Enrichment] Content type: ${contentType}`)

  // Initialize result
  const result: EnrichmentResult = {
    postId: post.id,
    success: false,
    transcriptExtracted: false,
    ocrExtracted: false,
    transcriptText: null,
    transcriptSummary: null,
    ocrText: null,
    sourcesUsed: {
      transcript: false,
      ocr: false,
      caption: Boolean(post.caption && post.caption.length > 0),
      metadata: Boolean(post.author_username || post.thumbnail_url),
    },
    confidence: 'low',
    error: null,
    processingTimeSeconds: 0,
  }

  try {
    // Update status to 'enriching'
    await supabaseAdmin
      .from('saved_posts')
      .update({ processing_status: 'enriching' })
      .eq('id', post.id)

    // Step 1: Transcribe reels/videos
    if ((contentType === 'REEL' || contentType === 'VIDEO') && ENABLE_TRANSCRIPTION) {
      console.log(`[Enrichment] Attempting transcription for ${contentType}`)

      // Try to find video URL from various sources
      let videoUrl: string | null = null

      // First, check if media_urls contains a direct video URL
      if (post.media_urls) {
        const mediaData = post.media_urls as any
        if (typeof mediaData === 'string') {
          // Single URL string
          if (mediaData.includes('.mp4') || mediaData.includes('.mov') || mediaData.includes('video')) {
            videoUrl = mediaData
          }
        } else if (Array.isArray(mediaData)) {
          // Array of URLs - find video
          const videoUrls = mediaData.filter(
            (url: any) =>
              typeof url === 'string' &&
              (url.includes('.mp4') || url.includes('.mov') || url.includes('video'))
          )
          videoUrl = videoUrls[0] || null
        } else if (mediaData.video_url) {
          videoUrl = mediaData.video_url
        } else if (mediaData.url && (mediaData.url.includes('video') || mediaData.url.includes('mp4'))) {
          videoUrl = mediaData.url
        }
      }

      // If no video URL in media_urls, check if instagram_url is a direct video link
      if (!videoUrl && post.instagram_url) {
        // Instagram sometimes includes video files directly
        if (
          post.instagram_url.includes('fbsbx.com') ||
          post.instagram_url.includes('_n.jpg') ||
          post.instagram_url.includes('video')
        ) {
          videoUrl = post.instagram_url
        }
      }

      if (videoUrl) {
        console.log(`[Enrichment] Found video URL, attempting transcription...`)

        const transcriptResult = await transcribeFromUrl(videoUrl, {
          language: 'en',
          prompt: 'This is a social media video. Transcribe everything the person says.',
        })

        if (transcriptResult.success && transcriptResult.text) {
          result.transcriptText = transcriptResult.text
          result.transcriptExtracted = true
          result.sourcesUsed.transcript = true

          console.log(
            `[Enrichment] ✓ Transcription success: ${transcriptResult.text.length} characters extracted`
          )

          // Step 1b: Generate summary from transcript
          if (transcriptResult.text.length > 50) {
            console.log(`[Enrichment] Generating summary from transcript...`)

            const summaryResult = await summarizeTranscript(transcriptResult.text, {
              maxSummaryLength: 150,
              style: 'detailed',
            })

            if (summaryResult.success && summaryResult.summary) {
              result.transcriptSummary = summaryResult.summary
              console.log(`[Enrichment] ✓ Summary generated: ${summaryResult.summary.length} characters`)
              console.log(`[Enrichment]   Summary: "${summaryResult.summary.substring(0, 100)}..."`)
            } else {
              console.warn(`[Enrichment] ✗ Summary generation failed: ${summaryResult.error}`)
            }
          }
        } else {
          console.warn(`[Enrichment] ✗ Transcription failed: ${transcriptResult.error}`)
          result.error = `Transcription failed: ${transcriptResult.error}`
        }
      } else {
        console.log(`[Enrichment] No video URL available for transcription`)
        console.log(`[Enrichment]   - instagram_url: ${post.instagram_url}`)
        console.log(`[Enrichment]   - media_urls: ${post.media_urls ? 'available' : 'null'}`)
        result.error = 'No video URL available - may require Instagram Graph API access'
      }
    }

    // Step 2: Run OCR on images/carousels
    if ((contentType === 'CAROUSEL' || contentType === 'IMAGE') && ENABLE_OCR) {
      console.log(`[Enrichment] Attempting OCR for ${contentType}`)

      // Get image URLs
      let imageUrls: string[] = []

      if (contentType === 'CAROUSEL' && post.media_urls) {
        // Parse media_urls array
        const mediaData = post.media_urls as any
        if (Array.isArray(mediaData)) {
          imageUrls = mediaData.filter((url) => typeof url === 'string')
        } else if (Array.isArray(mediaData.urls)) {
          imageUrls = mediaData.urls
        }
      } else if (post.thumbnail_url) {
        imageUrls = [post.thumbnail_url]
      }

      if (imageUrls.length > 0) {
        console.log(`[Enrichment] Running OCR on ${imageUrls.length} image(s)`)

        const ocrResult =
          imageUrls.length > 1
            ? await extractTextFromMultipleImages(imageUrls)
            : await extractTextFromImageUrl(imageUrls[0])

        if (ocrResult.success && ocrResult.text) {
          result.ocrText = ocrResult.text
          result.ocrExtracted = true
          result.sourcesUsed.ocr = true
          console.log(`[Enrichment] OCR success: ${ocrResult.text.length} chars extracted`)
        } else {
          console.warn(`[Enrichment] OCR failed: ${ocrResult.error}`)
          result.error = result.error
            ? `${result.error}; OCR failed: ${ocrResult.error}`
            : `OCR failed: ${ocrResult.error}`
        }
      } else {
        console.log(`[Enrichment] No image URLs available for OCR`)
        result.error = result.error
          ? `${result.error}; No image URLs for OCR`
          : 'No image URLs for OCR'
      }
    }

    // Step 3: Calculate confidence
    result.confidence = calculateEnrichmentConfidence(
      result.transcriptText,
      result.ocrText,
      post.caption,
      post.author_username
    )

    // Step 4: Store results in database
    const processingTimeSeconds = (Date.now() - startTime) / 1000
    result.processingTimeSeconds = processingTimeSeconds

    const updateData: any = {
      transcript_text: result.transcriptText,
      transcript_summary: result.transcriptSummary,
      ocr_text: result.ocrText,
      sources_used: result.sourcesUsed,
      content_confidence: result.confidence,
      processing_status: 'completed',
      enrichment_completed_at: new Date().toISOString(),
      processing_error: result.error,
      ...(result.transcriptSummary && { summary_generated_at: new Date().toISOString() }),
    }

    await supabaseAdmin.from('saved_posts').update(updateData).eq('id', post.id)

    result.success = true

    console.log(
      `[Enrichment] ✓ Completed for post ${post.id} in ${processingTimeSeconds.toFixed(2)}s`
    )
    console.log(`[Enrichment]   - Transcript: ${result.transcriptExtracted ? '✓' : '✗'}`)
    if (result.transcriptSummary) {
      console.log(`[Enrichment]   - Summary: ✓`)
    }
    console.log(`[Enrichment]   - OCR: ${result.ocrExtracted ? '✓' : '✗'}`)
    console.log(`[Enrichment]   - Caption: ${result.sourcesUsed.caption ? '✓' : '✗'}`)
    console.log(`[Enrichment]   - Confidence: ${result.confidence}`)

    return result
  } catch (error) {
    const processingTimeSeconds = (Date.now() - startTime) / 1000
    result.processingTimeSeconds = processingTimeSeconds

    const errorMessage = error instanceof Error ? error.message : String(error)
    result.error = errorMessage
    result.success = false

    console.error(`[Enrichment] ✗ Failed for post ${post.id}: ${errorMessage}`)

    // Update database with error
    await supabaseAdmin
      .from('saved_posts')
      .update({
        processing_status: 'failed',
        processing_error: errorMessage,
      })
      .eq('id', post.id)

    return result
  }
}

/**
 * Batch enrich multiple posts
 *
 * @param posts - Array of SavedPost records
 * @param options - Optional configuration
 * @returns Array of EnrichmentResult
 */
export async function enrichInstagramPosts(
  posts: SavedPost[],
  options?: {
    concurrent?: number // Max concurrent enrichments (default: 1 to avoid rate limits)
  }
): Promise<EnrichmentResult[]> {
  const concurrent = options?.concurrent || 1
  const results: EnrichmentResult[] = []

  console.log(`\n[Enrichment] Batch enriching ${posts.length} posts (concurrent: ${concurrent})`)

  // Process in batches to avoid overwhelming APIs
  for (let i = 0; i < posts.length; i += concurrent) {
    const batch = posts.slice(i, i + concurrent)
    const batchResults = await Promise.all(batch.map((post) => enrichInstagramPost(post)))
    results.push(...batchResults)

    console.log(`[Enrichment] Batch ${Math.floor(i / concurrent) + 1} completed`)
  }

  const successCount = results.filter((r) => r.success).length
  const transcriptCount = results.filter((r) => r.transcriptExtracted).length
  const ocrCount = results.filter((r) => r.ocrExtracted).length

  console.log(`\n[Enrichment] Batch complete:`)
  console.log(`  - Total: ${posts.length}`)
  console.log(`  - Success: ${successCount}`)
  console.log(`  - With transcript: ${transcriptCount}`)
  console.log(`  - With OCR: ${ocrCount}`)

  return results
}

/**
 * Enrich all pending posts
 * Useful for batch processing via cron job
 *
 * @returns Array of EnrichmentResult
 */
export async function enrichPendingPosts(): Promise<EnrichmentResult[]> {
  console.log(`\n[Enrichment] Fetching pending posts...`)

  const { data: posts, error } = await supabaseAdmin
    .from('saved_posts')
    .select('*')
    .eq('processing_status', 'pending')
    .limit(50) // Process up to 50 at a time

  if (error) {
    console.error(`[Enrichment] Failed to fetch pending posts:`, error)
    throw error
  }

  if (!posts || posts.length === 0) {
    console.log(`[Enrichment] No pending posts found`)
    return []
  }

  console.log(`[Enrichment] Found ${posts.length} pending posts`)

  return enrichInstagramPosts(posts)
}
