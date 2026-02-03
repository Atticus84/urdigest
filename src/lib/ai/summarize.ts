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

CRITICAL RULES:
- Write in a conversational, clever tone. Be informative but not dry.
- Each section covers one post. Create EXACTLY ${posts.length} sections, one for each post.
- Bold key phrases using <b> tags for skimmability.
- Taper section lengths — start longer (~80-100 words), end shorter (~40-60 words) to accelerate reading.

HANDLING MISSING DATA (VERY IMPORTANT):
- Many posts may have missing captions or unknown authors. This is NORMAL for Instagram shares.
- When caption is missing: Look at the URL to identify if it's a reel, photo, or post. Create engaging curiosity-driven copy like "You saved this one for a reason — <b>tap through to see what caught your eye</b>."
- When author is unknown: Use creative placeholders in the body like "from a creator worth checking out" or "dropped into your feed and made you stop scrolling."
- NEVER just say "No caption available" or show raw "Unknown" in your output. Transform it into engaging copy.
- For reels: "This reel made the cut — <b>worth a rewatch</b>."
- For photos: "A visual that spoke to you. <b>Sometimes a picture says it all</b>."

CONTENT CREATION:
- Posts can be photos, videos, reels, or carousels.
- The greeting should be one punchy line. No "Dear reader" energy. Examples: "Your feed had gems today.", "Look what you saved.", "The good stuff from your scroll session."
- The big_picture is a 2-3 sentence closing thought. Make it feel like a friend wrapping up. Reference the variety of content they saved.
- The subject_line should be catchy and intriguing (max 60 chars). Don't reference specific post content if data is missing — use general engaging lines like "Your saved posts, delivered ✨" or "What caught your eye today"
- Use exactly one emoji per section that fits the vibe (even if you're guessing the content).
- Do NOT use markdown. Use <b> tags for bold only.`

  const userPrompt = `
Write a Morning Brew-style newsletter from these ${posts.length} saved Instagram posts:

${posts.map((post, i) => {
  const postType = post.post_type || 'photo'
  const isReel = post.instagram_url?.includes('/reel/') || postType === 'reel' || postType === 'video'
  return `
POST ${i + 1}:
URL: ${post.instagram_url}
Author: ${post.author_username || '(not available)'}
Caption: ${post.caption || '(not available)'}
Type: ${isReel ? 'reel/video' : postType}
---
`}).join('\n')}

Return a JSON object with this exact structure:
{
  "subject_line": "Catchy email subject (max 60 chars)",
  "greeting": "One punchy opening line",
  "sections": [
    {
      "emoji": "🔥",
      "headline": "SHORT CATCHY HEADLINE (3-6 words, all caps)",
      "body": "60-100 word editorial write-up with <b>bold key phrases</b>. Conversational, insightful, skimmable. NEVER say 'no caption available' — write engaging copy instead.",
      "instagram_url": "https://instagram.com/...",
      "author_username": "username or null if unknown"
    }
  ],
  "big_picture": "2-3 sentence closing thought tying things together."
}

IMPORTANT:
- Return ONLY valid JSON
- Create EXACTLY ${posts.length} sections, one per post
- NEVER output "No caption available" or "Unknown" literally — transform missing data into engaging copy
- author_username should be null (not "null" string) if the author is unknown
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

// Fallback emojis and headlines for when AI is unavailable
const fallbackEmojis = ['✨', '🔥', '💫', '⭐', '🎯', '💡', '🌟', '📸', '🎬', '👀']
const fallbackHeadlinesWithCaption = [
  'WORTH A SECOND LOOK',
  'THIS ONE STOOD OUT',
  'SAVED FOR LATER',
  'CAUGHT YOUR EYE',
  'ONE TO REMEMBER',
]
const fallbackHeadlinesReel = [
  'REEL TALK',
  'ON REPEAT',
  'SCROLL STOPPER',
  'MUST-SEE REEL',
  'VIDEO GOLD',
]
const fallbackHeadlinesPhoto = [
  'VISUAL INSPO',
  'PICTURE PERFECT',
  'FRAME WORTHY',
  'AESTHETIC GOALS',
  'CAPTURED MOMENT',
]
const fallbackBodies = [
  'You saved this one for a reason. <b>Tap through to see what caught your attention</b> — sometimes your feed knows what you need.',
  'This made the cut in your scroll session. <b>Worth another look</b> when you have a moment.',
  'Something about this one made you stop scrolling. <b>Check it out</b> and remember why.',
  'Your past self saved this for your future self. <b>Time to see what the fuss was about</b>.',
  'This landed in your saves — <b>a sign it deserves your attention</b>.',
]

export function generateFallbackNewsletter(posts: SavedPost[]): NewsletterContent {
  const greetings = [
    "Here's what you saved today.",
    "Your saved posts, ready to revisit.",
    "Look what made it to your digest.",
    "The good stuff from your feed.",
  ]

  return {
    subject_line: posts.length === 1
      ? "You saved something good ✨"
      : `${posts.length} posts you saved — take a look`,
    greeting: greetings[Math.floor(Math.random() * greetings.length)],
    sections: posts.map((post, index) => {
      const isReel = post.instagram_url?.includes('/reel/') ||
                     post.post_type === 'reel' ||
                     post.post_type === 'video'
      const hasCaption = post.caption && post.caption.trim().length > 0
      const hasAuthor = post.author_username && post.author_username.trim().length > 0

      // Pick emoji based on index for variety
      const emoji = fallbackEmojis[index % fallbackEmojis.length]

      // Pick headline based on content type and whether we have a caption
      let headlines: string[]
      if (hasCaption) {
        headlines = fallbackHeadlinesWithCaption
      } else if (isReel) {
        headlines = fallbackHeadlinesReel
      } else {
        headlines = fallbackHeadlinesPhoto
      }
      const headline = headlines[index % headlines.length]

      // Create body - use caption if available, otherwise engaging fallback
      let body: string
      if (hasCaption) {
        // Truncate caption and add some editorial flair
        const truncatedCaption = post.caption!.length > 200
          ? post.caption!.slice(0, 200) + '...'
          : post.caption!
        body = truncatedCaption
      } else {
        // Use engaging fallback copy
        body = fallbackBodies[index % fallbackBodies.length]
      }

      return {
        emoji,
        headline,
        body,
        instagram_url: post.instagram_url,
        author_username: hasAuthor ? post.author_username : null,
      }
    }),
    big_picture: posts.length > 1
      ? "That's a wrap on today's saves. Your feed is a reflection of what inspires you — keep curating the good stuff."
      : '',
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
