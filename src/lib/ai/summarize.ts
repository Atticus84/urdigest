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

// Fetch an image URL and return it as a Gemini-compatible inline data part
async function fetchImageAsInlineData(url: string): Promise<Part | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    return {
      inlineData: {
        mimeType: contentType.split(';')[0],
        data: base64,
      },
    }
  } catch (error) {
    console.error(`Failed to fetch image from ${url}:`, error)
    return null
  }
}

// Build multimodal parts for a single post (text + images)
async function buildPostParts(post: SavedPost, index: number): Promise<Part[]> {
  const parts: Part[] = []

  // Text description of the post
  const postType = post.post_type || 'photo'
  let textDescription = `\n--- POST ${index} ---\n`
  textDescription += `Type: ${postType}\n`
  textDescription += `URL: ${post.instagram_url}\n`
  textDescription += `Author: ${post.author_username ? `@${post.author_username}` : 'Unknown'}\n`
  textDescription += `Caption: ${post.caption || 'No caption provided'}\n`

  parts.push({ text: textDescription })

  // Try to include visual content
  const imageUrls: string[] = []

  // Add thumbnail
  if (post.thumbnail_url) {
    imageUrls.push(post.thumbnail_url)
  }

  // Add media URLs (images, video thumbnails)
  if (post.media_urls && Array.isArray(post.media_urls)) {
    for (const url of post.media_urls) {
      if (typeof url === 'string' && !imageUrls.includes(url)) {
        // Only include image URLs (skip direct video URLs for now)
        if (!url.includes('.mp4') && !url.includes('video')) {
          imageUrls.push(url)
        }
      }
    }
  }

  // Fetch and attach up to 2 images per post to stay within limits
  for (const url of imageUrls.slice(0, 2)) {
    const imagePart = await fetchImageAsInlineData(url)
    if (imagePart) {
      parts.push(imagePart)
    }
  }

  // If this is a reel/video with no images, note it for the AI
  if ((postType === 'reel' || postType === 'video') && imageUrls.length === 0) {
    parts.push({ text: '[This is a video/reel — no thumbnail was available. Summarize based on the caption and context.]\n' })
  }

  return parts
}

export async function summarizePosts(
  posts: SavedPost[]
): Promise<{
  summaries: PostSummary[]
  tokensUsed: number
  cost: number
}> {
  const systemPrompt = `You are an AI assistant that summarizes Instagram posts into concise, engaging summaries for email digests.

You will receive a mix of text descriptions and images for each post. When images are provided, use them to understand the visual content — what's shown in photos, screenshots of text, infographics, food, places, products, outfits, memes, etc.

For reels and videos, you may receive a thumbnail frame. Use it along with the caption to infer what the video is about.

For each post, provide:
1. A catchy one-line title (10-15 words) that captures the essence of the content
2. A 2-3 sentence summary highlighting key insights, what's shown visually, and why it's worth revisiting
3. Up to 3 relevant tags

Be conversational, enthusiastic, and helpful. Focus on actionable insights. When you can see the image, describe what's actually in it rather than just echoing the caption.`

  const userParts: Part[] = [
    { text: `Summarize these ${posts.length} Instagram posts for today's digest. I'm including images where available — use them to give better summaries.\n` },
  ]

  // Build multimodal parts for each post
  for (let i = 0; i < posts.length; i++) {
    const postParts = await buildPostParts(posts[i], i)
    userParts.push(...postParts)
  }

  userParts.push({
    text: `\nReturn a JSON array with this exact structure:
[
  {
    "post_index": 0,
    "title": "One-line catchy summary",
    "summary": "2-3 sentences about what makes this post valuable, referencing visual content when available",
    "tags": ["tag1", "tag2", "tag3"]
  }
]

IMPORTANT: Return ONLY the JSON array, no other text or markdown fencing.`,
  })

  try {
    const model = getGenAI().getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
    })

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }, ...userParts] },
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

    // Parse response
    let parsedResponse: any
    try {
      parsedResponse = JSON.parse(text)
    } catch {
      throw new Error('Failed to parse Gemini response as JSON')
    }

    // Handle both array and object with array responses
    const summaries = Array.isArray(parsedResponse)
      ? parsedResponse
      : parsedResponse.summaries || []

    // Validate summaries
    if (!Array.isArray(summaries) || summaries.length !== posts.length) {
      throw new Error(`Expected ${posts.length} summaries, got ${summaries.length}`)
    }

    return {
      summaries,
      tokensUsed,
      cost,
    }
  } catch (error) {
    console.error('Gemini summarization error:', error)
    throw error
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
