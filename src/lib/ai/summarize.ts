import OpenAI from 'openai'
import { SavedPost } from '@/types/database'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface PostSummary {
  post_index: number
  title: string
  summary: string
  tags: string[]
}

export async function summarizePosts(
  posts: SavedPost[]
): Promise<{
  summaries: PostSummary[]
  tokensUsed: number
  cost: number
}> {
  const systemPrompt = `You are an AI assistant that summarizes Instagram posts into concise, engaging summaries for email digests.

For each post, provide:
1. A catchy one-line title (10-15 words)
2. A 2-3 sentence summary highlighting key insights or what makes this content valuable
3. Up to 3 relevant tags

Be conversational, enthusiastic, and helpful. Focus on actionable insights.`

  const userPrompt = `
Summarize these ${posts.length} Instagram posts for today's digest:

${posts.map((post, i) => `
POST ${i}:
URL: ${post.instagram_url}
Author: ${post.author_username ? `@${post.author_username}` : 'Unknown'}
Caption: ${post.caption || 'No caption'}
Type: ${post.post_type || 'photo'}
---
`).join('\n')}

Return a JSON array with this exact structure:
[
  {
    "post_index": 0,
    "title": "One-line catchy summary",
    "summary": "2-3 sentences about what makes this post valuable",
    "tags": ["tag1", "tag2", "tag3"]
  }
]

IMPORTANT: Return ONLY the JSON array, no other text.
`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const response = completion.choices[0].message.content
    const tokensUsed = completion.usage?.total_tokens || 0

    // Calculate cost (GPT-4o-mini pricing as of Jan 2026)
    const inputTokens = completion.usage?.prompt_tokens || 0
    const outputTokens = completion.usage?.completion_tokens || 0
    const cost = (inputTokens * 0.00015 / 1000) + (outputTokens * 0.0006 / 1000)

    // Parse response
    let parsedResponse: any
    try {
      parsedResponse = JSON.parse(response || '{}')
    } catch {
      throw new Error('Failed to parse OpenAI response as JSON')
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
    console.error('OpenAI summarization error:', error)
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
