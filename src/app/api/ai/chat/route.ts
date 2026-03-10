import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { z } from 'zod'

const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10000),
  })).max(20).default([]),
})

export const dynamic = 'force-dynamic'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = chatRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const { message, conversationHistory } = parsed.data

    // RAG: Retrieve relevant posts based on the user's question
    const searchTerms = message.trim()
    const searchTerm = `%${searchTerms}%`

    // Search across all content fields
    const { data: relevantPosts } = await supabase
      .from('saved_posts')
      .select('*')
      .eq('user_id', user.id)
      .or(
        `caption.ilike.${searchTerm},transcript_text.ilike.${searchTerm},transcript_summary.ilike.${searchTerm},ocr_text.ilike.${searchTerm},author_username.ilike.${searchTerm}`
      )
      .order('saved_at', { ascending: false })
      .limit(10)

    // Also get recent posts for general context
    const { data: recentPosts } = await supabase
      .from('saved_posts')
      .select('*')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .limit(15)

    // Get user stats
    const { data: userData } = await supabase
      .from('users')
      .select('total_posts_saved, total_digests_sent, instagram_username')
      .eq('id', user.id)
      .single()

    // Merge and deduplicate posts (relevant first, then recent for context)
    const seenIds = new Set<string>()
    const contextPosts: typeof relevantPosts = []
    for (const post of [...(relevantPosts || []), ...(recentPosts || [])]) {
      if (!seenIds.has(post.id)) {
        seenIds.add(post.id)
        contextPosts.push(post)
      }
    }

    // Build context string from posts
    const postsContext = contextPosts.slice(0, 20).map((post, i) => {
      const parts = [`POST ${i + 1}:`]
      if (post.author_username) parts.push(`Author: @${post.author_username}`)
      if (post.post_type) parts.push(`Type: ${post.post_type}`)
      if (post.saved_at) parts.push(`Saved: ${new Date(post.saved_at).toLocaleDateString()}`)
      if (post.caption) parts.push(`Caption: ${post.caption.slice(0, 300)}`)
      if (post.transcript_text) parts.push(`Transcript: ${post.transcript_text.slice(0, 500)}`)
      if (post.transcript_summary) parts.push(`Summary: ${post.transcript_summary.slice(0, 300)}`)
      if (post.ocr_text) parts.push(`OCR Text: ${post.ocr_text.slice(0, 300)}`)
      if (post.instagram_url) parts.push(`URL: ${post.instagram_url}`)
      return parts.join('\n')
    }).join('\n\n---\n\n')

    const systemPrompt = `You are a personal knowledge assistant for someone's saved Instagram content. You have access to their saved posts, including captions, video transcripts, image text (OCR), and metadata.

USER STATS:
- Total posts saved: ${userData?.total_posts_saved || 0}
- Total digests sent: ${userData?.total_digests_sent || 0}
- Instagram: @${userData?.instagram_username || 'unknown'}

THEIR SAVED CONTENT (${contextPosts.length} posts loaded):
${postsContext || '(No posts found)'}

INSTRUCTIONS:
- Answer questions about their saved content naturally and helpfully
- Reference specific posts with author names and details when relevant
- If they ask for recommendations, patterns, or themes — analyze their saves
- If the content doesn't contain what they're asking about, say so honestly
- Keep responses concise but informative — like a smart friend who's read all their saves
- When referencing a post, include the Instagram URL so they can tap through
- You can analyze trends (what topics they save most, which creators they follow, etc.)
- Be conversational, not robotic. Match the Morning Brew tone: sharp, casual, useful.`

    // Build messages array with conversation history
    const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ]

    // Add conversation history (last 10 messages)
    const recentHistory = conversationHistory.slice(-10)
    for (const msg of recentHistory) {
      chatMessages.push({
        role: msg.role,
        content: msg.content,
      })
    }

    chatMessages.push({ role: 'user', content: message })

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 1000,
    })

    const reply = completion.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate a response.'
    const tokensUsed = completion.usage?.total_tokens || 0

    return NextResponse.json({
      reply,
      tokensUsed,
      postsSearched: contextPosts.length,
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
