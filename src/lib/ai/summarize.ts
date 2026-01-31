import { GoogleGenerativeAI, Part } from '@google/generative-ai'
import { SavedPost } from '@/types/database'

let _genai: GoogleGenerativeAI | null = null
function getGenAI() {
  if (!_genai) _genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
  return _genai
}

export interface PostSummary {
  post_index: number
  title: string
  summary: string
  tags: string[]
}

const BATCH_SIZE = 10 // Posts per Gemini call to stay within context limits

// Fetch a media URL and return it as a Gemini-compatible inline data part
async function fetchMediaAsInlineData(url: string): Promise<Part | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const mime = contentType.split(';')[0]

    // Skip if content is too large (>15MB) to avoid blowing up memory
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 15 * 1024 * 1024) {
      console.log(`Skipping oversized media (${contentLength} bytes): ${url}`)
      return null
    }

    const buffer = await response.arrayBuffer()

    // Double-check actual size
    if (buffer.byteLength > 15 * 1024 * 1024) {
      console.log(`Skipping oversized media after download (${buffer.byteLength} bytes): ${url}`)
      return null
    }

    const base64 = Buffer.from(buffer).toString('base64')

    return {
      inlineData: {
        mimeType: mime,
        data: base64,
      },
    }
  } catch (error) {
    console.error(`Failed to fetch media from ${url}:`, error)
    return null
  }
}

// Collect the best media URL for a post (thumbnail for images, video URL or thumbnail for reels)
function getMediaUrl(post: SavedPost): string | null {
  // Prefer thumbnail for all post types — it's always an image and works reliably
  if (post.thumbnail_url) return post.thumbnail_url

  // Fall back to first media URL
  if (post.media_urls && Array.isArray(post.media_urls)) {
    for (const url of post.media_urls) {
      if (typeof url === 'string') return url
    }
  }

  return null
}

// Fetch media for multiple posts in parallel
async function fetchAllMedia(posts: SavedPost[]): Promise<(Part | null)[]> {
  const urls = posts.map(getMediaUrl)
  const results = await Promise.all(
    urls.map(url => (url ? fetchMediaAsInlineData(url) : Promise.resolve(null)))
  )
  return results
}

// Build the prompt parts for a batch of posts (with pre-fetched media)
function buildBatchParts(
  posts: SavedPost[],
  mediaParts: (Part | null)[],
  globalOffset: number
): Part[] {
  const parts: Part[] = []

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]
    const postType = post.post_type || 'photo'
    const globalIndex = globalOffset + i

    let textDescription = `\n--- POST ${globalIndex} ---\n`
    textDescription += `Type: ${postType}\n`
    textDescription += `URL: ${post.instagram_url}\n`
    textDescription += `Author: ${post.author_username ? `@${post.author_username}` : 'Unknown'}\n`
    textDescription += `Caption: ${post.caption || 'No caption provided'}\n`

    parts.push({ text: textDescription })

    // Attach the media if we fetched it
    if (mediaParts[i]) {
      parts.push(mediaParts[i]!)
    } else if (postType === 'reel' || postType === 'video') {
      parts.push({ text: '[This is a video/reel — no visual preview was available. Summarize based on the caption and context.]\n' })
    }
  }

  return parts
}

const SYSTEM_PROMPT = `You are an AI assistant that summarizes Instagram posts into concise, engaging summaries for email digests.

You will receive a mix of text descriptions and images/video thumbnails for each post. When visuals are provided, use them to understand the content — what's shown in photos, screenshots of text, infographics, food, places, products, outfits, memes, etc.

For reels and videos, you may receive a thumbnail frame. Use it along with the caption to infer what the video is about.

For each post, provide:
1. A catchy one-line title (10-15 words) that captures the essence of the content
2. A 2-3 sentence summary highlighting key insights, what's shown visually, and why it's worth revisiting
3. Up to 3 relevant tags

Be conversational, enthusiastic, and helpful. Focus on actionable insights. When you can see the image, describe what's actually in it rather than just echoing the caption.`

// Summarize a single batch of posts
async function summarizeBatch(
  posts: SavedPost[],
  globalOffset: number
): Promise<{ summaries: PostSummary[]; tokensUsed: number; cost: number }> {
  // Fetch all media in parallel
  const mediaParts = await fetchAllMedia(posts)

  const postParts = buildBatchParts(posts, mediaParts, globalOffset)

  const userParts: Part[] = [
    { text: `Summarize these ${posts.length} Instagram posts for today's digest. I'm including images where available — use them to give better summaries.\n` },
    ...postParts,
    {
      text: `\nReturn a JSON array with this exact structure (post_index should match the numbers above):
[
  {
    "post_index": ${globalOffset},
    "title": "One-line catchy summary",
    "summary": "2-3 sentences about what makes this post valuable, referencing visual content when available",
    "tags": ["tag1", "tag2", "tag3"]
  }
]

IMPORTANT: Return ONLY the JSON array, no other text or markdown fencing.`,
    },
  ]

  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
  })

  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }, ...userParts] },
    ],
  })

  const response = result.response
  const text = response.text()
  const usage = response.usageMetadata

  const tokensUsed = (usage?.promptTokenCount || 0) + (usage?.candidatesTokenCount || 0)
  // Gemini 2.0 Flash pricing: $0.10/M input, $0.40/M output
  const cost =
    ((usage?.promptTokenCount || 0) * 0.0001) / 1000 +
    ((usage?.candidatesTokenCount || 0) * 0.0004) / 1000

  let parsedResponse: any
  try {
    parsedResponse = JSON.parse(text)
  } catch {
    throw new Error('Failed to parse Gemini response as JSON')
  }

  const summaries: PostSummary[] = Array.isArray(parsedResponse)
    ? parsedResponse
    : parsedResponse.summaries || []

  if (!Array.isArray(summaries) || summaries.length !== posts.length) {
    throw new Error(`Expected ${posts.length} summaries, got ${summaries.length}`)
  }

  return { summaries, tokensUsed, cost }
}

export async function summarizePosts(
  posts: SavedPost[]
): Promise<{
  summaries: PostSummary[]
  tokensUsed: number
  cost: number
}> {
  // For small batches, do it in one call
  if (posts.length <= BATCH_SIZE) {
    return summarizeBatch(posts, 0)
  }

  // For larger sets, split into batches and process sequentially
  // (sequential to avoid rate limits and keep costs predictable)
  const allSummaries: PostSummary[] = []
  let totalTokens = 0
  let totalCost = 0

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE)
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(posts.length / BATCH_SIZE)} (${batch.length} posts)`)

    try {
      const result = await summarizeBatch(batch, i)
      allSummaries.push(...result.summaries)
      totalTokens += result.tokensUsed
      totalCost += result.cost
    } catch (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed, using fallback for these posts:`, error)
      // Fallback for this batch only — don't lose the whole digest
      const fallbacks = generateFallbackSummaries(batch).map((s, j) => ({
        ...s,
        post_index: i + j,
      }))
      allSummaries.push(...fallbacks)
    }
  }

  return {
    summaries: allSummaries,
    tokensUsed: totalTokens,
    cost: totalCost,
  }
}

// Fallback: Generate simple summaries without AI
export function generateFallbackSummaries(posts: SavedPost[]): PostSummary[] {
  return posts.map((post, index) => ({
    post_index: index,
    title: post.caption
      ? post.caption.slice(0, 60) + (post.caption.length > 60 ? '...' : '')
      : `${post.post_type || 'Post'} by @${post.author_username || 'unknown'}`,
    summary: post.caption || 'No caption available for this post.',
    tags: [],
  }))
}
