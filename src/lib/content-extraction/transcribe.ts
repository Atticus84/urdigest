import OpenAI from 'openai'
import * as fs from 'fs'
import { createReadStream } from 'fs'

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

export interface TranscriptionResult {
  success: boolean
  text: string | null
  error: string | null
  duration_seconds: number | null
  language: string | null
  cost_usd: number | null
}

/**
 * Transcribe audio/video file using OpenAI Whisper API
 *
 * @param filePath - Path to audio/video file (mp4, mp3, wav, etc.)
 * @param options - Optional configuration
 * @returns Transcription result with text, error, and metadata
 *
 * Pricing: $0.006 per minute (as of 2024)
 * Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
 * Max file size: 25 MB
 */
export async function transcribeFile(
  filePath: string,
  options?: {
    language?: string // ISO-639-1 format (e.g., 'en', 'es')
    prompt?: string // Optional context to improve accuracy
  }
): Promise<TranscriptionResult> {
  const startTime = Date.now()

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        text: null,
        error: `File not found: ${filePath}`,
        duration_seconds: null,
        language: null,
        cost_usd: null,
      }
    }

    // Check file size (25 MB limit)
    const stats = fs.statSync(filePath)
    const fileSizeMB = stats.size / (1024 * 1024)
    if (fileSizeMB > 25) {
      return {
        success: false,
        text: null,
        error: `File too large: ${fileSizeMB.toFixed(2)} MB (max 25 MB). Consider chunking.`,
        duration_seconds: null,
        language: null,
        cost_usd: null,
      }
    }

    console.log(`[Transcription] Starting transcription for: ${filePath} (${fileSizeMB.toFixed(2)} MB)`)

    // Call OpenAI Whisper API
    const response = await getOpenAI().audio.transcriptions.create({
      file: createReadStream(filePath),
      model: 'whisper-1',
      language: options?.language,
      prompt: options?.prompt,
      response_format: 'verbose_json', // Get detailed metadata
    })

    const duration = (Date.now() - startTime) / 1000

    // Calculate cost (as of 2024: $0.006 per minute)
    // response.duration is in seconds
    const durationMinutes = (response.duration || 0) / 60
    const cost = durationMinutes * 0.006

    console.log(`[Transcription] Success! Duration: ${response.duration}s, Text length: ${response.text.length} chars, Cost: $${cost.toFixed(4)}`)

    return {
      success: true,
      text: response.text,
      error: null,
      duration_seconds: response.duration || null,
      language: response.language || null,
      cost_usd: cost,
    }
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000

    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Transcription] Failed after ${duration.toFixed(2)}s:`, errorMessage)

    return {
      success: false,
      text: null,
      error: errorMessage,
      duration_seconds: null,
      language: null,
      cost_usd: null,
    }
  }
}

/**
 * Transcribe from URL (downloads to temp file first)
 *
 * @param url - URL to audio/video file
 * @param options - Optional configuration
 * @returns Transcription result
 */
export async function transcribeFromUrl(
  url: string,
  options?: {
    language?: string
    prompt?: string
    tempDir?: string
  }
): Promise<TranscriptionResult> {
  const tempDir = options?.tempDir || '/tmp'
  const tempFileName = `transcribe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.mp4`
  const tempFilePath = `${tempDir}/${tempFileName}`

  try {
    console.log(`[Transcription] Downloading ${url} to ${tempFilePath}`)

    // Download file
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
    }

    const buffer = await response.arrayBuffer()
    fs.writeFileSync(tempFilePath, Buffer.from(buffer))

    console.log(`[Transcription] Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`)

    // Transcribe
    const result = await transcribeFile(tempFilePath, {
      language: options?.language,
      prompt: options?.prompt,
    })

    // Cleanup
    try {
      fs.unlinkSync(tempFilePath)
      console.log(`[Transcription] Cleaned up temp file: ${tempFilePath}`)
    } catch (cleanupError) {
      console.warn(`[Transcription] Failed to cleanup temp file:`, cleanupError)
    }

    return result
  } catch (error) {
    // Cleanup on error
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath)
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Transcription] Failed to download/transcribe from URL:`, errorMessage)

    return {
      success: false,
      text: null,
      error: errorMessage,
      duration_seconds: null,
      language: null,
      cost_usd: null,
    }
  }
}

/**
 * Chunk transcription for files > 25 MB
 * (Not implemented - requires ffmpeg to split audio)
 *
 * For large files, use external tool to split first:
 *   ffmpeg -i input.mp4 -f segment -segment_time 600 -c copy output%03d.mp4
 */
export async function transcribeChunked(filePath: string): Promise<TranscriptionResult> {
  throw new Error('Chunked transcription not implemented. Split files manually with ffmpeg first.')
}
