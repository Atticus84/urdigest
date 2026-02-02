import OpenAI from 'openai'
import { SavedPost } from '@/types/database'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

export interface PostSummary {
  post_index: number
  title: string
  summary: string
  tags: string[]
}

export interface NewsletterSection {
  emoji: string
  headline: string
  body: string
  instagram_url: string
  author_username: string | null
}

export interface NewsletterContent {
  subject_line: string
  greeting: string
  sections: NewsletterSection[]
  big_picture: string
}

export async function generateNewsletter(
  posts: SavedPost[]
): Promise<{
  newsletter: NewsletterContent
  tokensUsed: number
  cost: number
}> {
  const systemPrompt = `You are a witty, sharp newsletter editor writing a daily digest email in the style of Morning Brew. Your job is to transform saved Instagram posts into an engaging, editorial newsletter that people actually want to read.

Rules:
- Write in a conversational, clever tone. Be informative but not dry.
- Each section covers one post (or groups closely related posts together).
- Bold key phrases using <b> tags for skimmability.
- Taper section lengths — start longer (~80-100 words), end shorter (~40-60 words) to accelerate reading.
- If a post has no caption or very little info, keep it brief and curiosity-driven ("This caught your eye — tap through to see why").
- The greeting should be one punchy line. No "Dear reader" energy.
- The big_picture is a 2-3 sentence closing thought that ties themes together or leaves the reader with something to think about.
- The subject_line should be catchy and reference the most interesting post topic (max 60 chars).
- Use exactly one emoji per section that fits the content.
- Do NOT use markdown. Use <b> tags for bold only.`

  const userPrompt = `
Write a Morning Brew-style newsletter from these ${posts.length} saved Instagram posts:

${posts.map((post, i) => `
POST ${i}:
URL: ${post.instagram_url}
Author: ${post.author_username ? `@${post.author_username}` : 'Unknown'}
Caption: ${post.caption || 'No caption available'}
Type: ${post.post_type || 'photo'}
---
`).join('\n')}

Return a JSON object with this exact structure:
{
  "subject_line": "Catchy email subject (max 60 chars)",
  "greeting": "One punchy opening line",
  "sections": [
    {
      "emoji": "🔥",
      "headline": "BOLD SECTION HEADLINE",
      "body": "60-100 word editorial write-up with <b>bold key phrases</b>. Conversational, insightful, skimmable.",
      "instagram_url": "https://instagram.com/...",
      "author_username": "username"
    }
  ],
  "big_picture": "2-3 sentence closing thought tying things together."
}

IMPORTANT: Return ONLY valid JSON. One section per post (or group very related posts). Sections array must cover ALL posts.
`

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    })

    const response = completion.choices[0].message.content
    const tokensUsed = completion.usage?.total_tokens || 0

    const inputTokens = completion.usage?.prompt_tokens || 0
    const outputTokens = completion.usage?.completion_tokens || 0
    const cost = (inputTokens * 0.00015 / 1000) + (outputTokens * 0.0006 / 1000)

    let parsed: any
    try {
      parsed = JSON.parse(response || '{}')
    } catch {
      throw new Error('Failed to parse OpenAI response as JSON')
    }

    const newsletter: NewsletterContent = {
      subject_line: parsed.subject_line || `Your daily urdigest: ${posts.length} posts`,
      greeting: parsed.greeting || "Here's what you saved today.",
      sections: parsed.sections || [],
      big_picture: parsed.big_picture || '',
    }

    if (!newsletter.sections.length) {
      throw new Error('AI returned no sections')
    }

    return { newsletter, tokensUsed, cost }
  } catch (error) {
    console.error('OpenAI newsletter generation error:', error)
    throw error
  }
}

export function generateFallbackNewsletter(posts: SavedPost[]): NewsletterContent {
  return {
    subject_line: `Your daily urdigest: ${posts.length} posts`,
    greeting: "Here's what you saved today.",
    sections: posts.map((post) => ({
      emoji: '📌',
      headline: post.caption
        ? post.caption.slice(0, 60) + (post.caption.length > 60 ? '...' : '')
        : `Post by @${post.author_username || 'unknown'}`,
      body: post.caption || 'No caption available for this post.',
      instagram_url: post.instagram_url,
      author_username: post.author_username,
    })),
    big_picture: '',
  }
}

// Keep legacy exports for backwards compatibility if needed elsewhere
export async function summarizePosts(
  posts: SavedPost[]
): Promise<{
  summaries: PostSummary[]
  tokensUsed: number
  cost: number
}> {
  const { newsletter, tokensUsed, cost } = await generateNewsletter(posts)

  const summaries: PostSummary[] = newsletter.sections.map((section, index) => ({
    post_index: index,
    title: section.headline,
    summary: section.body,
    tags: [],
  }))

  return { summaries, tokensUsed, cost }
}

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
