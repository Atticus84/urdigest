import { createWorker, Worker, RecognizeResult } from 'tesseract.js'
import * as fs from 'fs'
import os from 'os'
import path from 'path'

export interface OCRResult {
  success: boolean
  text: string | null
  confidence: number | null
  error: string | null
  duration_seconds: number
}

let _worker: Worker | null = null

function resolveNodeWorkerPath() {
  return path.join(
    process.cwd(),
    'node_modules',
    'tesseract.js',
    'src',
    'worker-script',
    'node',
    'index.js'
  )
}

/**
 * Shared worker creation options — ensures every worker gets the same
 * workerPath, logger, and errorHandler regardless of how it's created.
 */
function getWorkerOptions() {
  return {
    workerPath: resolveNodeWorkerPath(),
    logger: (m: { status: string; progress: number }) => {
      if (process.env.OCR_DEBUG === 'true') {
        console.log(`[OCR Worker] ${m.status} ${(m.progress * 100).toFixed(0)}%`)
      }
    },
    errorHandler: (err: any) => {
      console.error('[OCR Worker] error', err)
    },
  }
}

/**
 * Get or create Tesseract worker (singleton for the default 'eng' language).
 */
async function getWorker(): Promise<Worker> {
  if (!_worker) {
    console.log('[OCR] Initializing Tesseract worker...')
    const options = getWorkerOptions()

    if (!fs.existsSync(options.workerPath)) {
      throw new Error(`OCR worker script not found: ${options.workerPath}`)
    }

    _worker = await createWorker('eng', undefined, options)
    console.log('[OCR] Worker initialized')
  }
  return _worker
}

/**
 * Create a one-off worker for a non-default language.
 * This avoids corrupting the singleton English worker.
 */
async function createLanguageWorker(language: string): Promise<Worker> {
  console.log(`[OCR] Creating one-off worker for language: ${language}`)
  const options = getWorkerOptions()

  if (!fs.existsSync(options.workerPath)) {
    throw new Error(`OCR worker script not found: ${options.workerPath}`)
  }

  return createWorker(language, undefined, options)
}

/**
 * Clean up Tesseract worker (call on shutdown)
 */
export async function terminateOCRWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate()
    _worker = null
    console.log('[OCR] Worker terminated')
  }
}

/**
 * Extract text from image using Tesseract OCR
 *
 * @param imagePath - Path to image file (jpg, png, etc.)
 * @param options - Optional configuration
 * @returns OCR result with text, confidence, and metadata
 */
export async function extractTextFromImage(
  imagePath: string,
  options?: {
    language?: string // Default: 'eng'
  }
): Promise<OCRResult> {
  const startTime = Date.now()

  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return {
        success: false,
        text: null,
        confidence: null,
        error: `File not found: ${imagePath}`,
        duration_seconds: 0,
      }
    }

    console.log(`[OCR] Starting OCR for: ${imagePath}`)

    // Use a one-off worker for non-default languages to avoid corrupting the
    // English singleton. The one-off worker is terminated after use.
    const isCustomLanguage = options?.language && options.language !== 'eng'
    const worker = isCustomLanguage
      ? await createLanguageWorker(options!.language!)
      : await getWorker()

    // Run OCR
    let result: RecognizeResult
    try {
      result = await worker.recognize(imagePath)
    } finally {
      // Only terminate one-off workers, never the singleton
      if (isCustomLanguage) {
        await worker.terminate()
      }
    }

    const duration = (Date.now() - startTime) / 1000

    // Clean up text (remove excessive whitespace)
    const cleanedText = result.data.text
      .trim()
      .replace(/\n\s*\n/g, '\n') // Remove multiple blank lines
      .replace(/[ \t]+/g, ' ') // Normalize spaces

    console.log(
      `[OCR] Success! Duration: ${duration.toFixed(2)}s, Text length: ${cleanedText.length} chars, Confidence: ${result.data.confidence.toFixed(2)}%`
    )

    return {
      success: true,
      text: cleanedText.length > 0 ? cleanedText : null,
      confidence: result.data.confidence,
      error: null,
      duration_seconds: duration,
    }
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000

    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[OCR] Failed after ${duration.toFixed(2)}s:`, errorMessage)

    return {
      success: false,
      text: null,
      confidence: null,
      error: errorMessage,
      duration_seconds: duration,
    }
  }
}

/**
 * Extract text from image URL (downloads to temp file first)
 *
 * @param url - URL to image file
 * @param options - Optional configuration
 * @returns OCR result
 */
export async function extractTextFromImageUrl(
  url: string,
  options?: {
    language?: string
    tempDir?: string
  }
): Promise<OCRResult> {
  const tempDir = options?.tempDir || os.tmpdir()
  const tempFileName = `ocr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.img`
  const tempFilePath = path.join(tempDir, tempFileName)

  try {
    fs.mkdirSync(tempDir, { recursive: true })

    console.log(`[OCR] Downloading ${url} to ${tempFilePath}`)

    // Download file
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (contentType && !contentType.startsWith('image/')) {
      throw new Error(`Downloaded content is not an image (${contentType})`)
    }

    const buffer = await response.arrayBuffer()
    const maxImageBytes = Number(process.env.OCR_MAX_IMAGE_BYTES || 15 * 1024 * 1024)
    if (buffer.byteLength > maxImageBytes) {
      throw new Error(
        `Image too large: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB (max ${(maxImageBytes / 1024 / 1024).toFixed(2)} MB)`
      )
    }

    fs.writeFileSync(tempFilePath, Buffer.from(buffer))

    console.log(`[OCR] Downloaded ${(buffer.byteLength / 1024).toFixed(2)} KB`)

    // Run OCR
    const result = await extractTextFromImage(tempFilePath, {
      language: options?.language,
    })

    // Cleanup
    try {
      fs.unlinkSync(tempFilePath)
      console.log(`[OCR] Cleaned up temp file: ${tempFilePath}`)
    } catch (cleanupError) {
      console.warn(`[OCR] Failed to cleanup temp file:`, cleanupError)
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
    console.error(`[OCR] Failed to download/process image from URL:`, errorMessage)

    return {
      success: false,
      text: null,
      confidence: null,
      error: errorMessage,
      duration_seconds: 0,
    }
  }
}

/**
 * Extract text from multiple images (e.g., carousel)
 * Returns combined text from all images
 *
 * @param imageUrls - Array of image URLs
 * @param options - Optional configuration
 * @returns Combined OCR result
 */
export async function extractTextFromMultipleImages(
  imageUrls: string[],
  options?: {
    language?: string
    tempDir?: string
  }
): Promise<OCRResult> {
  const startTime = Date.now()

  try {
    console.log(`[OCR] Processing ${imageUrls.length} images`)

    const results: OCRResult[] = []

    // Process images sequentially to avoid overwhelming the system
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i]
      console.log(`[OCR] Processing image ${i + 1}/${imageUrls.length}: ${url}`)

      const result = await extractTextFromImageUrl(url, options)
      results.push(result)

      // If any image fails, log but continue
      if (!result.success) {
        console.warn(`[OCR] Image ${i + 1} failed: ${result.error}`)
      }
    }

    // Combine successful results
    const successfulResults = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.success && result.text)
    const combinedText = successfulResults
      .map(({ result, index }) => {
        // Add image number prefix for clarity
        return `[Image ${index + 1}]\n${result.text}`
      })
      .join('\n\n')

    // Average confidence
    const avgConfidence =
      successfulResults.length > 0
        ? successfulResults.reduce((sum, item) => sum + (item.result.confidence || 0), 0) / successfulResults.length
        : null

    const duration = (Date.now() - startTime) / 1000

    if (successfulResults.length === 0) {
      console.warn(`[OCR] All ${imageUrls.length} images failed`)
      return {
        success: false,
        text: null,
        confidence: null,
        error: `All ${imageUrls.length} images failed OCR`,
        duration_seconds: duration,
      }
    }

    console.log(
      `[OCR] Completed ${successfulResults.length}/${imageUrls.length} images in ${duration.toFixed(2)}s, Combined text: ${combinedText.length} chars`
    )

    return {
      success: true,
      text: combinedText.length > 0 ? combinedText : null,
      confidence: avgConfidence,
      error: successfulResults.length < imageUrls.length ? `${imageUrls.length - successfulResults.length} images failed` : null,
      duration_seconds: duration,
    }
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000

    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[OCR] Failed after ${duration.toFixed(2)}s:`, errorMessage)

    return {
      success: false,
      text: null,
      confidence: null,
      error: errorMessage,
      duration_seconds: duration,
    }
  }
}
