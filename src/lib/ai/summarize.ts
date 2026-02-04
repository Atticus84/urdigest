import OpenAI from 'openai'
import { SavedPost } from '@/types/database'
import {
  NormalizedDigestItem,
  normalizeInstagramPosts,
  getContentTypeLabel,
  getContentTypeEmoji
} from '@/lib/instagram/normalize'

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
  // Enhanced structured fields for Morning Brew-style layout
  title?: string // Short headline (<= 8 words, editorial style)
  lede?: string // 1-2 sentence summary
  takeaways?: string[] // 2-5 actionable bullets
  why_you_saved_it?: string // 1 sentence guess based on content
  content_type_label?: string // "Reel", "Carousel", "Post", etc.
  content_type_emoji?: string // Type-specific emoji
}

export interface NewsletterContent {
  subject_line: string
  greeting: string
  sections: NewsletterSection[]
  big_picture: string
}

/**
 * Generate newsletter from normalized Instagram content items
 * This is the preferred method for new code as it uses the normalization layer
 */
export async function generateNewsletterFromNormalized(
  items: NormalizedDigestItem[]
): Promise<{
  newsletter: NewsletterContent
  tokensUsed: number
  cost: number
}> {
  const systemPrompt = `You are a witty, sharp newsletter editor writing a daily digest email in the style of Morning Brew. Your job is to transform saved Instagram posts into an engaging, editorial newsletter that people actually want to read.

CRITICAL OUTPUT FORMAT:
Each section MUST include these fields in the JSON response:
- emoji: One relevant emoji that fits the content
- headline: ALL CAPS headline (3-6 words)
- title: Short editorial headline (max 8 words, not all caps, engaging)
- lede: 1-2 sentence summary in Morning Brew style (witty, conversational, informative)
- takeaways: Array of 2-5 bullet points (actionable, memorable insights)
- body: 60-100 word editorial write-up with <b>bold key phrases</b>
- why_you_saved_it: One sentence explaining why the user likely saved this (based on content signals)
- content_type_label: Human-readable type ("Reel", "Carousel", "Post", "Video")
- instagram_url: Full Instagram URL
- author_username: Username or null if unknown

STYLE GUIDELINES:
- Write in a conversational, clever tone. Be informative but not dry.
- Bold key phrases using <b> tags for skimmability.
- Taper section lengths — start longer (~80-100 words), end shorter (~40-60 words).
- Create EXACTLY ${items.length} sections, one for each post.

HANDLING DIFFERENT CONTENT TYPES:
- REELS: Focus on the video format, if caption mentions audio/music reference it
- CAROUSELS: Acknowledge multiple images, mention visual storytelling
- VIDEOS: Emphasize movement, action, or tutorial-style content
- STATIC POSTS: Focus on the single image and caption message

HANDLING MISSING DATA (CRITICAL):
- Low confidence content (missing caption/creator): Create curiosity-driven copy
- For reels without caption: "This reel made the cut — worth a rewatch to see what caught your eye."
- For images without caption: "A visual that spoke to you. Sometimes a picture says it all."
- For posts with minimal info: "You saved this one for a reason — tap through to remember why."
- NEVER output "No caption available" or "Unknown" literally — transform it into engaging copy.
- Use conservative language when confidence is low: "Looks like...", "This appears to...", "Seems to be..."

TAKEAWAYS GUIDELINES:
- Make them actionable and memorable
- Extract key insights or lessons from the content
- If content is low-confidence, make takeaways about why it caught attention
- Format as short, punchy statements

The greeting should be one punchy line. Examples: "Your feed had gems today.", "Look what you saved.", "The good stuff from your scroll session."

The big_picture is a 2-3 sentence closing thought. Reference the variety of content they saved.

The subject_line should be catchy and intriguing (max 60 chars). Don't reference specifics if data is missing — use general engaging lines.

Do NOT use markdown. Use <b> tags for bold only.`

  const userPrompt = `
Write a Morning Brew-style newsletter from these ${items.length} saved Instagram posts:

${items.map((item, i) => {
  const confidenceNote = item.confidence === 'low'
    ? '(⚠️ Limited data - use conservative language)'
    : ''
  return `
POST ${i + 1}: ${confidenceNote}
URL: ${item.url}
Type: ${item.igType}${item.mediaCount > 1 ? ` (${item.mediaCount} images)` : ''}
Author: ${item.creatorHandle || '(not available)'}
Caption: ${item.captionText || '(not available)'}
Confidence: ${item.confidence}
Extracted Summary: ${item.extractedTextSummary}
---
`}).join('\n')}

Return a JSON object with this EXACT structure (all fields required):
{
  "subject_line": "Catchy email subject (max 60 chars)",
  "greeting": "One punchy opening line",
  "sections": [
    {
      "emoji": "🔥",
      "headline": "SHORT HEADLINE (ALL CAPS, 3-6 WORDS)",
      "title": "Editorial Headline In Title Case",
      "lede": "1-2 sentence Morning Brew-style summary with personality.",
      "takeaways": [
        "First actionable insight or key point",
        "Second memorable takeaway",
        "Third insight (optional, 2-5 total)"
      ],
      "body": "60-100 word editorial with <b>bold phrases</b>. Never say 'no caption available' — create engaging copy.",
      "why_you_saved_it": "One sentence explaining the likely reason for saving this.",
      "content_type_label": "Reel",
      "instagram_url": "https://instagram.com/...",
      "author_username": "username or null if unknown"
    }
  ],
  "big_picture": "2-3 sentence closing tying things together."
}

IMPORTANT:
- Return ONLY valid JSON
- Create EXACTLY ${items.length} sections
- Include ALL required fields in each section
- NEVER output "No caption available" — transform missing data into engaging copy
- Use conservative phrasing for low-confidence content
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
      subject_line: parsed.subject_line || `Your daily urdigest: ${items.length} posts`,
      greeting: parsed.greeting || "Here's what you saved today.",
      sections: parsed.sections || [],
      big_picture: parsed.big_picture || '',
    }

    if (!newsletter.sections.length) {
      throw new Error('AI returned no sections')
    }

    // Enrich sections with content type data from normalized items
    newsletter.sections = newsletter.sections.map((section, index) => {
      const item = items[index]
      return {
        ...section,
        content_type_emoji: section.content_type_emoji || getContentTypeEmoji(item.igType),
        content_type_label: section.content_type_label || getContentTypeLabel(item.igType),
      }
    })

    return { newsletter, tokensUsed, cost }
  } catch (error) {
    console.error('OpenAI newsletter generation error:', error)
    throw error
  }
}

/**
 * Legacy function - converts SavedPost to normalized items and calls new function
 * @deprecated Use generateNewsletterFromNormalized with pre-normalized items instead
 */
export async function generateNewsletter(
  posts: SavedPost[]
): Promise<{
  newsletter: NewsletterContent
  tokensUsed: number
  cost: number
}> {
  // Normalize posts and delegate to new function
  const normalizedItems = normalizeInstagramPosts(posts)
  return generateNewsletterFromNormalized(normalizedItems)
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

/**
 * Generate fallback newsletter from normalized items when AI is unavailable
 */
export function generateFallbackNewsletterFromNormalized(items: NormalizedDigestItem[]): NewsletterContent {
  const greetings = [
    "Here's what you saved today.",
    "Your saved posts, ready to revisit.",
    "Look what made it to your digest.",
    "The good stuff from your feed.",
  ]

  return {
    subject_line: items.length === 1
      ? "You saved something good ✨"
      : `${items.length} posts you saved — take a look`,
    greeting: greetings[Math.floor(Math.random() * greetings.length)],
    sections: items.map((item, index) => {
      const isReel = item.igType === 'REEL'
      const isVideo = item.igType === 'VIDEO'
      const hasCaption = item.captionText && item.captionText.trim().length > 0

      // Pick emoji - use type-specific emoji from normalize
      const emoji = getContentTypeEmoji(item.igType)

      // Pick headline based on content type and confidence
      let headlines: string[]
      if (hasCaption) {
        headlines = fallbackHeadlinesWithCaption
      } else if (isReel || isVideo) {
        headlines = fallbackHeadlinesReel
      } else {
        headlines = fallbackHeadlinesPhoto
      }
      const headline = headlines[index % headlines.length]

      // Create title (for new format)
      const title = headline.split(' ').map(w =>
        w.charAt(0) + w.slice(1).toLowerCase()
      ).join(' ')

      // Create body and lede
      let body: string
      let lede: string
      if (hasCaption) {
        const truncatedCaption = item.captionText!.length > 200
          ? item.captionText!.slice(0, 200) + '...'
          : item.captionText!
        body = truncatedCaption
        lede = item.captionText!.length > 150
          ? item.captionText!.slice(0, 150) + '...'
          : item.captionText!
      } else {
        body = fallbackBodies[index % fallbackBodies.length]
        lede = `You saved this ${item.igType.toLowerCase()}. Worth revisiting to see what caught your attention.`
      }

      // Generate simple takeaways
      const takeaways: string[] = []
      if (hasCaption) {
        takeaways.push('Review the full caption for context')
        if (item.creatorHandle) {
          takeaways.push(`Content from @${item.creatorHandle}`)
        }
      } else {
        takeaways.push('Tap through to remember why you saved this')
        takeaways.push(`${getContentTypeLabel(item.igType)} content worth reviewing`)
      }

      return {
        emoji,
        headline,
        title,
        lede,
        takeaways,
        body,
        why_you_saved_it: hasCaption
          ? 'Something in this caption resonated with you.'
          : 'The visual or content caught your eye while scrolling.',
        content_type_label: getContentTypeLabel(item.igType),
        content_type_emoji: getContentTypeEmoji(item.igType),
        instagram_url: item.url,
        author_username: item.creatorHandle,
      }
    }),
    big_picture: items.length > 1
      ? "That's a wrap on today's saves. Your feed is a reflection of what inspires you — keep curating the good stuff."
      : '',
  }
}

/**
 * Legacy fallback function
 * @deprecated Use generateFallbackNewsletterFromNormalized with pre-normalized items
 */
export function generateFallbackNewsletter(posts: SavedPost[]): NewsletterContent {
  // Normalize posts and delegate to new function
  const normalizedItems = normalizeInstagramPosts(posts)
  return generateFallbackNewsletterFromNormalized(normalizedItems)
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
