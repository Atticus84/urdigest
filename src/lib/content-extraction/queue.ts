import { inngest } from '@/inngest/client'

/**
 * Enqueue asynchronous enrichment for a saved post.
 * This is best-effort and should not block post ingestion.
 */
export async function enqueueSavedPostEnrichment(postId: string, userId: string): Promise<void> {
  try {
    await inngest.send({
      name: 'saved-post/enrich.requested',
      data: {
        postId,
        userId,
        requestedAt: new Date().toISOString(),
      },
    })

    console.log(`[EnrichmentQueue] queued saved post ${postId} for enrichment`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[EnrichmentQueue] failed to enqueue post ${postId}: ${message}`)
  }
}
