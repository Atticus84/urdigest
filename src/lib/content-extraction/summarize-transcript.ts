import OpenAI from 'openai'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured')
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

export interface TranscriptSummaryResult {
  success: boolean
  summary: string | null
  error: string | null
  tokens_used: number | null
  cost_usd: number | null
}

/**
 * Generate a concise summary from a video transcript
 *
 * @param transcript - The transcript text to summarize
 * @param options - Optional configuration
 * @returns Summary result with text, error, and cost
 *
 * Pricing: $0.30 per 1M input tokens, $0.60 per 1M output tokens (GPT-4o Mini)
 */
export async function summarizeTranscript(
  transcript: string,
  options?: {
    maxSummaryLength?: number // Approximate target length in words (default: 100-150)
    style?: 'brief' | 'detailed' | 'bullets' // Summary style (default: 'detailed')
    language?: string // Language hint (default: 'English')
  }
): Promise<TranscriptSummaryResult> {
  const startTime = Date.now()

  try {
    if (!transcript || transcript.trim().length === 0) {
      return {
        success: false,
        summary: null,
        error: 'Transcript is empty',
        tokens_used: null,
        cost_usd: null,
      }
    }

    const maxLength = options?.maxSummaryLength || 150
    const style = options?.style || 'detailed'
    const language = options?.language || 'English'

    // Truncate transcript if too long (to avoid huge context)
    const truncatedTranscript = transcript.substring(0, 8000) // ~2000 tokens

    const systemPrompt = `You are a concise content summarizer. Your job is to distill video transcripts into clear, actionable summaries.

SUMMARY STYLE: ${style.toUpperCase()}

${
  style === 'brief'
    ? 'Keep it SHORT and punchy - 1-2 sentences max, capturing only the main point'
    : style === 'bullets'
    ? 'Use 3-5 bullet points listing key takeaways or main topics covered'
    : 'Write a focused ${maxLength}-word summary with context and key insights'
}

Guidelines:
- Be factual - only summarize what was actually said in the transcript
- Extract key insights, tips, or information
- Use clear, conversational language
- Avoid jargon unless necessary
- If the video covers multiple topics, mention the progression
- Focus on what's USEFUL or INTERESTING to the viewer

Language: ${language}`

    const userPrompt = `Please summarize this video transcript in approximately ${maxLength} words:\n\n---\n${truncatedTranscript}\n---`

    console.log(`[Transcript Summarization] Starting summary generation (${style} style, ~${maxLength} words)`)

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300, // Usually won't need more for 150-word summary
    })

    const summary = response.choices[0]?.message?.content || ''
    const tokensUsed = response.usage?.total_tokens || 0

    // Calculate cost (GPT-4o Mini: $0.30 per 1M input tokens, $0.60 per 1M output tokens)
    const inputTokens = response.usage?.prompt_tokens || 0
    const outputTokens = response.usage?.completion_tokens || 0
    const cost = (inputTokens * 0.30 + outputTokens * 0.60) / 1_000_000

    console.log(
      `[Transcript Summarization] ✓ Generated ${summary.length} chars, ${tokensUsed} tokens, Cost: $${cost.toFixed(4)}`
    )

    return {
      success: true,
      summary: summary.trim(),
      error: null,
      tokens_used: tokensUsed,
      cost_usd: cost,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Transcript Summarization] ✗ Failed:`, errorMessage)

    return {
      success: false,
      summary: null,
      error: errorMessage,
      tokens_used: null,
      cost_usd: null,
    }
  }
}

/**
 * Batch summarize multiple transcripts
 *
 * @param transcripts - Array of transcript texts to summarize
 * @param options - Optional configuration
 * @returns Array of summary results
 */
export async function summarizeTranscriptsBatch(
  transcripts: string[],
  options?: {
    maxSummaryLength?: number
    style?: 'brief' | 'detailed' | 'bullets'
    language?: string
    concurrentLimit?: number // Max concurrent API calls (default: 2)
  }
): Promise<TranscriptSummaryResult[]> {
  const concurrentLimit = options?.concurrentLimit || 2
  const results: TranscriptSummaryResult[] = []

  console.log(`[Transcript Summarization] Batch processing ${transcripts.length} transcripts (concurrent: ${concurrentLimit})`)

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < transcripts.length; i += concurrentLimit) {
    const batch = transcripts.slice(i, i + concurrentLimit)
    const batchResults = await Promise.all(
      batch.map((transcript) =>
        summarizeTranscript(transcript, {
          maxSummaryLength: options?.maxSummaryLength,
          style: options?.style,
          language: options?.language,
        })
      )
    )
    results.push(...batchResults)

    console.log(`[Transcript Summarization] Batch ${Math.floor(i / concurrentLimit) + 1} completed`)
  }

  const successCount = results.filter((r) => r.success).length
  const totalCost = results.reduce((sum, r) => sum + (r.cost_usd || 0), 0)

  console.log(`[Transcript Summarization] Batch complete:`)
  console.log(`  - Total: ${transcripts.length}`)
  console.log(`  - Success: ${successCount}`)
  console.log(`  - Total cost: $${totalCost.toFixed(4)}`)

  return results
}
