import OpenAI from 'openai'
import * as fs from 'fs'
import { createReadStream } from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function execFileAsync(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { windowsHide: true, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`${command} failed: ${error.message}${stderr ? ` :: ${stderr}` : ''}`))
          return
        }
        resolve()
      }
    )
  })
}

async function extractAudioForWhisper(inputPath: string): Promise<string> {
  const parsed = path.parse(inputPath)
  const outputPath = path.join(parsed.dir, `${parsed.name}.whisper.mp3`)

  await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-b:a',
    '64k',
    outputPath,
  ])

  return outputPath
}

function shouldRetryViaAudioExtraction(errorMessage: string | null, filePath: string): boolean {
  if (!errorMessage) return false
  const lower = errorMessage.toLowerCase()
  const looksLikeVideo = /\.(mp4|mov|m4v|webm)$/i.test(filePath)
  return (
    looksLikeVideo &&
    (lower.includes('something went wrong reading your request') ||
      lower.includes('invalid file format') ||
      lower.includes('400 '))
  )
}

function shouldRetryTranscriptionRequest(errorMessage: string | null): boolean {
  if (!errorMessage) return false
  const lower = errorMessage.toLowerCase()
  return (
    lower.includes('connection error') ||
    lower.includes('timeout') ||
    lower.includes('etimedout') ||
    lower.includes('econnreset') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('500')
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error) {
    const maybe = error as any
    if (typeof maybe.message === 'string' && maybe.message) return maybe.message
    if (typeof maybe.status === 'number') return `${maybe.status} status code (no body)`
  }
  return String(error)
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
  return transcribeFileWithRetry(filePath, options)
}

async function transcribeFileWithRetry(
  filePath: string,
  options?: {
    language?: string
    prompt?: string
  },
  maxAttempts = 3
): Promise<TranscriptionResult> {
  const startTime = Date.now()

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

  const timeoutMs = Number(process.env.WHISPER_TIMEOUT_MS || 120_000)
  let lastError: string | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[Transcription] Starting transcription for: ${filePath} (${fileSizeMB.toFixed(
          2
        )} MB) [attempt ${attempt}/${maxAttempts}]`
      )

      const response = await getOpenAI().audio.transcriptions.create(
        {
          file: createReadStream(filePath),
          model: 'whisper-1',
          language: options?.language,
          prompt: options?.prompt,
          response_format: 'verbose_json',
        },
        { timeout: timeoutMs }
      )

      const duration = (Date.now() - startTime) / 1000
      const durationMinutes = (response.duration || 0) / 60
      const cost = durationMinutes * 0.006

      console.log(
        `[Transcription] Success! Duration: ${response.duration}s, Text length: ${response.text.length} chars, Cost: $${cost.toFixed(
          4
        )}`
      )

      return {
        success: true,
        text: response.text,
        error: null,
        duration_seconds: response.duration || null,
        language: response.language || null,
        cost_usd: cost,
      }
    } catch (error) {
      lastError = getErrorMessage(error)
      const retryable = shouldRetryTranscriptionRequest(lastError)
      console.error(
        `[Transcription] Failed attempt ${attempt}/${maxAttempts}:`,
        lastError
      )

      if (!retryable || attempt >= maxAttempts) {
        break
      }

      await sleep(1500 * attempt)
    }
  }

  const duration = (Date.now() - startTime) / 1000
  console.error(`[Transcription] Failed after ${duration.toFixed(2)}s:`, lastError)

  return {
    success: false,
    text: null,
    error: lastError,
    duration_seconds: null,
    language: null,
    cost_usd: null,
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
  const tempDir = options?.tempDir || os.tmpdir()
  const tempFileName = `transcribe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.mp4`
  const tempFilePath = path.join(tempDir, tempFileName)
  let extractedAudioPath: string | null = null

  try {
    // Ensure temp directory exists (important on Windows where /tmp may map to a missing drive path)
    fs.mkdirSync(tempDir, { recursive: true })

    console.log(`[Transcription] Downloading ${url} to ${tempFilePath}`)

    // Download file
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
    }

    const buffer = await response.arrayBuffer()
    fs.writeFileSync(tempFilePath, Buffer.from(buffer))

    console.log(`[Transcription] Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`)

    // Prefer extracted audio for reliability with Whisper.
    let result: TranscriptionResult
    try {
      extractedAudioPath = await extractAudioForWhisper(tempFilePath)
      console.log('[Transcription] Using ffmpeg-extracted audio for transcription...')
      result = await transcribeFileWithRetry(extractedAudioPath, {
        language: options?.language,
        prompt: options?.prompt,
      })
    } catch (audioExtractError) {
      const audioExtractErrorMessage = getErrorMessage(audioExtractError)
      console.warn(
        `[Transcription] Audio extraction failed, falling back to source media: ${audioExtractErrorMessage}`
      )
      result = await transcribeFileWithRetry(tempFilePath, {
        language: options?.language,
        prompt: options?.prompt,
      })
    }

    // Some MP4 containers/codecs fail Whisper parsing even when the file downloads correctly.
    // Fallback: extract/convert audio to MP3 via ffmpeg and retry transcription.
    if (!result.success && !extractedAudioPath && shouldRetryViaAudioExtraction(result.error, tempFilePath)) {
      try {
        console.log('[Transcription] Retrying via ffmpeg audio extraction...')
        extractedAudioPath = await extractAudioForWhisper(tempFilePath)
        result = await transcribeFileWithRetry(extractedAudioPath, {
          language: options?.language,
          prompt: options?.prompt,
        })
      } catch (fallbackError) {
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        result = {
          ...result,
          success: false,
          error: `${result.error}; audio_extract_retry_failed: ${fallbackMessage}`,
        }
      }
    }

    // Cleanup
    try {
      fs.unlinkSync(tempFilePath)
      console.log(`[Transcription] Cleaned up temp file: ${tempFilePath}`)
    } catch (cleanupError) {
      console.warn(`[Transcription] Failed to cleanup temp file:`, cleanupError)
    }
    try {
      if (extractedAudioPath && fs.existsSync(extractedAudioPath)) {
        fs.unlinkSync(extractedAudioPath)
        console.log(`[Transcription] Cleaned up extracted audio: ${extractedAudioPath}`)
      }
    } catch (cleanupError) {
      console.warn(`[Transcription] Failed to cleanup extracted audio:`, cleanupError)
    }

    return result
  } catch (error) {
    // Cleanup on error
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath)
      }
      if (extractedAudioPath && fs.existsSync(extractedAudioPath)) {
        fs.unlinkSync(extractedAudioPath)
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
