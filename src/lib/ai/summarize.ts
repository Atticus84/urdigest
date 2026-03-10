import OpenAI from 'openai'
import { SavedPost } from '@/types/database'
import {
  NormalizedDigestItem,
  normalizeInstagramPosts,
  getContentTypeLabel,
  getContentTypeEmoji,
  generateSourcesAttribution
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
  takeaways?: string[] // 3-6 substantive bullets with real data
  key_quote?: string // Best direct quote from transcript/caption
  talking_points?: string[] // 2-4 discussion-worthy points
  why_you_saved_it?: string // 1 sentence guess based on content
  content_type_label?: string // "Reel", "Carousel", "Post", etc.
  content_type_emoji?: string // Type-specific emoji
  sources_attribution?: string // "Transcript ✅ OCR ❌ Caption ✅"
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
  const systemPrompt = `You are the editor of a daily newsletter that reads like Morning Brew — sharp, witty, and impossible to skim past. Your readers are busy people scrolling on their phones. Every sentence needs to earn the next one.

YOUR #1 JOB: Extract the ACTUAL learnings, data, advice, and value from every post. You have transcripts, OCR text, and captions — mine them for specifics. Your reader saved this post because it taught them something or gave them something useful. Your job is to pull that value out so they never need to re-watch the video or re-read the carousel.

VOICE & TONE:
- Write like a smart friend texting you the good stuff, not a journalist writing a formal recap.
- Short paragraphs. One to three sentences max.
- Lead with the insight, not the setup. "Here's why that matters" > "In a recent post, the creator discussed..."
- Bold the single most important phrase in each paragraph using <b> tags. Not every other word — just the hook.
- Use contractions. Use fragments. Start sentences with "And" or "But" when it flows.
- Be EXTREMELY specific. "Cut your grocery bill by 30% by shopping on Wednesdays" beats "Save money on groceries."
- Never say "In this reel..." or "The creator discusses..." — just deliver the insight directly.
- Never say "no caption available" — if data is thin, write a short, honest teaser.

CONTENT EXTRACTION PRIORITY (this is critical):
You'll receive posts with TRANSCRIPT (from video audio) and/or OCR TEXT (from images). Your job is to EXTRACT THE ACTUAL VALUE from these sources — not just summarize that they exist.

1. TRANSCRIPT → This is gold. The creator is literally teaching or explaining something. Pull out:
   - Specific advice, steps, methods, or frameworks they mention
   - Any numbers, stats, percentages, or data points
   - Direct quotes that capture the key insight
   - The "aha moment" — the one thing that makes this worth saving
2. OCR TEXT → This is text from carousel slides or infographics. Extract:
   - The actual tips, lists, or steps shown on screen
   - Specific claims, statistics, or facts
   - Any frameworks, formulas, or processes
3. CAPTION → Use the creator's own framing of their content
4. NOTHING → Write a tight 1-2 sentence teaser. Don't invent details.

STRUCTURE PER SECTION:
- title: Punchy editorial headline, 4-8 words, title case. Make it specific — "The 5-Second Rule That Fixes Your Mornings" not "Morning Routine Tips."
- lede: 1-2 sentences. This is the hook. Deliver the core insight immediately.
- body: 60-120 words. This is the MEAT. Go deep here. Explain the actual method, advice, or insight the creator shared. Use <b>bold</b> sparingly for the key insight. Write in short paragraphs. If the creator shared a 3-step process, explain all 3 steps. If they cited a study, mention the finding.
- takeaways: 3-6 bullet points. THIS IS THE MOST IMPORTANT PART. Each bullet should be a specific, actionable piece of knowledge extracted from the post. NOT vague summaries like "Great advice about fitness" — instead write "Do 20 minutes of zone 2 cardio before breakfast for 2x fat burn." Pull real numbers, real steps, real advice. If the transcript mentions a specific technique, name it. If the OCR shows a list of 5 tips, include all 5. These should be so good that reading just the bullets gives you 80% of the post's value.
- key_quote: The single best direct quote from the transcript or caption. Something punchy and quotable. If the transcript says "The biggest mistake people make is...", pull that. Leave empty string if no good quote exists.
- talking_points: 2-4 points that make this worth discussing with a friend. Frame them as conversation starters: "Apparently your morning coffee should wait 90 minutes after waking up" or "The 80/20 rule applies to meal prep too — 80% of results come from just 3 meals."
- why_you_saved_it: One casual sentence connecting to real life.
- headline: ALL CAPS version of the title for structural use (3-5 words).
- emoji: One emoji that fits the vibe.
- content_type_label: "Reel", "Carousel", "Post", or "Video"
- instagram_url: Pass through the URL.
- author_username: Pass through or null.

OVERALL NEWSLETTER:
- subject_line: Under 50 chars. Curiosity-driven. Reference a specific insight from the best post.
- greeting: One line, max 10 words. Casual. No exclamation marks.
- big_picture: 2-3 sentences. Tie the themes together and surface the single biggest takeaway across all posts.

Create EXACTLY ${items.length} sections, one per post. Return ONLY valid JSON. Do NOT use markdown — only <b> tags for bold.`

  const userPrompt = `
Write a Morning Brew-style newsletter from these ${items.length} saved Instagram posts:

${items.map((item, i) => {
  const confidenceNote = item.confidence === 'low'
    ? '(⚠️ Limited data - use conservative language)'
    : ''

  // Build content section prioritizing transcript > OCR > caption
  let contentSection = ''
  const sources = []

  if (item.transcriptText && item.transcriptText.length > 0) {
    contentSection += `\nTRANSCRIPT (from video audio):\n${item.transcriptText}\n`
    sources.push('Transcript')
  }

  if (item.ocrText && item.ocrText.length > 0) {
    contentSection += `\nOCR TEXT (from image):\n${item.ocrText}\n`
    sources.push('OCR')
  }

  if (item.captionText && item.captionText.length > 0) {
    contentSection += `\nCAPTION:\n${item.captionText}\n`
    sources.push('Caption')
  }

  if (contentSection === '') {
    contentSection = '\n(No text content available - minimal metadata only)\n'
  }

  const sourcesUsed = sources.length > 0 ? sources.join(' + ') : 'None'

  return `
POST ${i + 1}: ${confidenceNote}
URL: ${item.url}
Type: ${item.igType}${item.mediaCount > 1 ? ` (${item.mediaCount} images)` : ''}
Author: ${item.creatorHandle || '(not available)'}
Confidence: ${item.confidence}
Sources Available: ${sourcesUsed}${contentSection}---
`}).join('\n')}

Return a JSON object with this EXACT structure:
{
  "subject_line": "Under 50 chars, reference a specific insight",
  "greeting": "One casual line, max 10 words",
  "sections": [
    {
      "emoji": "🔥",
      "headline": "ALL CAPS 3-5 WORDS",
      "title": "Punchy Title Case Headline 4-8 Words",
      "lede": "1-2 sentence hook delivering the core insight.",
      "body": "60-120 words. Go deep. Explain the actual method/advice/insight. <b>Bold the key insight</b>.",
      "takeaways": [
        "Specific actionable insight #1 with real data or steps",
        "Specific actionable insight #2 — name techniques, cite numbers",
        "Specific actionable insight #3 — so good you don't need to watch the original"
      ],
      "key_quote": "Best direct quote from transcript or caption. Empty string if none.",
      "talking_points": [
        "Conversation-worthy framing of a key idea from this post",
        "Another angle worth discussing — framed as something you'd tell a friend"
      ],
      "why_you_saved_it": "One casual sentence connecting to real life.",
      "content_type_label": "Reel",
      "instagram_url": "https://instagram.com/...",
      "author_username": "username or null"
    }
  ],
  "big_picture": "2-3 sentences. Tie themes together. Surface the single biggest takeaway."
}

RULES:
- Return ONLY valid JSON, no markdown
- EXACTLY ${items.length} sections, one per post
- All fields required in each section (key_quote and talking_points can be empty string/array if truly no content)
- takeaways is THE MOST IMPORTANT FIELD — make each bullet a real piece of knowledge, not a vague summary
- If a transcript has specific steps, tips, or numbers — they MUST appear in the takeaways
- Never say "no caption available" — write a short teaser instead
- Low-confidence posts get fewer but still honest takeaways
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

    // Enrich sections with content type data and sources attribution from normalized items
    newsletter.sections = newsletter.sections.map((section, index) => {
      const item = items[index]
      return {
        ...section,
        content_type_emoji: section.content_type_emoji || getContentTypeEmoji(item.igType),
        content_type_label: section.content_type_label || getContentTypeLabel(item.igType),
        sources_attribution: generateSourcesAttribution(item),
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

// --- Fallback copy (Morning Brew tone) ---

const fallbackHeadlines: Record<string, string[]> = {
  caption: ['WORTH ANOTHER LOOK', 'THIS ONE HIT', 'SAVED FOR A REASON', 'DON\'T SLEEP ON THIS'],
  reel:    ['REEL TALK', 'STOP SCROLLING', 'MUST WATCH', 'ON REPEAT'],
  photo:   ['FRAME THIS ONE', 'VISUAL GOLD', 'THE AESTHETIC', 'CAUGHT YOUR EYE'],
}

const fallbackBodies = [
  'Your past self saved this for a reason. <b>Worth the tap-through</b> when you have a sec.',
  'Something here made you stop scrolling. <b>That instinct was probably right.</b>',
  'This made the cut. <b>Time to revisit what caught your eye.</b>',
  'Landed in your saves — <b>your feed has good taste</b>.',
]

/**
 * Generate fallback newsletter from normalized items when AI is unavailable.
 * Uses the same tight, casual tone as the AI version.
 */
export function generateFallbackNewsletterFromNormalized(items: NormalizedDigestItem[]): NewsletterContent {
  const greetings = [
    'Good stuff in your saves today.',
    'Your feed came through.',
    'Some things worth a second look.',
    'Here\'s what caught your eye.',
  ]

  return {
    subject_line: items.length === 1
      ? 'You saved something worth revisiting'
      : `${items.length} saves from your feed`,
    greeting: greetings[Math.floor(Math.random() * greetings.length)],
    sections: items.map((item, index) => {
      const isReel = item.igType === 'REEL'
      const isVideo = item.igType === 'VIDEO'
      const hasCaption = item.captionText && item.captionText.trim().length > 0
      const emoji = getContentTypeEmoji(item.igType)

      // Pick headline pool
      const pool = (isReel || isVideo) ? fallbackHeadlines.reel
        : hasCaption ? fallbackHeadlines.caption
        : fallbackHeadlines.photo
      const headline = pool[index % pool.length]

      // Title case version
      const title = headline.split(' ').map(w =>
        w.charAt(0) + w.slice(1).toLowerCase()
      ).join(' ')

      // Lede + body
      let lede: string
      let body: string
      if (hasCaption) {
        lede = item.captionText!.length > 120
          ? item.captionText!.slice(0, 120).trim() + '...'
          : item.captionText!
        body = item.captionText!.length > 200
          ? item.captionText!.slice(0, 200).trim() + '...'
          : item.captionText!
      } else {
        lede = `A ${getContentTypeLabel(item.igType).toLowerCase()} that made you hit save.`
        body = fallbackBodies[index % fallbackBodies.length]
      }

      // Takeaways — extract from transcript/OCR when available
      const takeaways: string[] = []
      if (item.transcriptText && item.transcriptText.length > 50) {
        // Pull first two meaningful sentences from transcript as takeaways
        const sentences = item.transcriptText.split(/[.!?]+/).filter(s => s.trim().length > 20).slice(0, 3)
        for (const s of sentences) {
          takeaways.push(s.trim())
        }
      }
      if (item.ocrText && item.ocrText.length > 20) {
        const ocrLines = item.ocrText.split('\n').filter(l => l.trim().length > 10).slice(0, 3)
        for (const l of ocrLines) {
          takeaways.push(l.trim())
        }
      }
      if (takeaways.length === 0 && hasCaption && item.creatorHandle) {
        takeaways.push(`From @${item.creatorHandle} — worth following if you aren't already`)
      }
      if (takeaways.length === 0) {
        takeaways.push('Tap through for the full thing')
      }

      // Key quote
      const key_quote = item.transcriptText
        ? (item.transcriptText.split(/[.!?]+/).find(s => s.trim().length > 30 && s.trim().length < 150) || '').trim()
        : ''

      // Talking points
      const talking_points: string[] = []
      if (hasCaption && item.captionText!.length > 50) {
        talking_points.push(item.captionText!.slice(0, 120).trim())
      }

      return {
        emoji,
        headline,
        title,
        lede,
        body,
        takeaways,
        key_quote,
        talking_points,
        why_you_saved_it: hasCaption
          ? 'Something in here clicked with you.'
          : 'The kind of thing you\'ll be glad you saved.',
        content_type_label: getContentTypeLabel(item.igType),
        content_type_emoji: getContentTypeEmoji(item.igType),
        sources_attribution: generateSourcesAttribution(item),
        instagram_url: item.url,
        author_username: item.creatorHandle,
      }
    }),
    big_picture: items.length > 1
      ? 'That\'s today\'s round-up. Your saves say a lot about where your head is at — keep curating.'
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
