import { createWorker, Worker, RecognizeResult } from 'tesseract.js'
import * as fs from 'fs'

export interface OCRResult {
  success: boolean
  text: string | null
  confidence: number | null
  error: string | null
  duration_seconds: number
}

let _worker: Worker | null = null

/**
 * Get or create Tesseract worker (singleton for performance)
 */
async function getWorker(): Promise<Worker> {
  if (!_worker) {
    console.log('[OCR] Initializing Tesseract worker...')
    _worker = await createWorker('eng') // English language
    console.log('[OCR] Worker initialized')
  }
  return _worker
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

    // Get worker
    const worker = await getWorker()

    // If custom language, reinitialize worker
    if (options?.language && options.language !== 'eng') {
      console.log(`[OCR] Switching to language: ${options.language}`)
      await worker.terminate()
      _worker = await createWorker(options.language)
    }

    // Run OCR
    const result: RecognizeResult = await worker.recognize(imagePath)

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
  const tempDir = options?.tempDir || '/tmp'
  const tempFileName = `ocr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.jpg`
  const tempFilePath = `${tempDir}/${tempFileName}`

  try {
    console.log(`[OCR] Downloading ${url} to ${tempFilePath}`)

    // Download file
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
    }

    const buffer = await response.arrayBuffer()
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
    const successfulResults = results.filter((r) => r.success && r.text)
    const combinedText = successfulResults
      .map((r, i) => {
        // Add image number prefix for clarity
        return `[Image ${i + 1}]\n${r.text}`
      })
      .join('\n\n')

    // Average confidence
    const avgConfidence =
      successfulResults.length > 0
        ? successfulResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / successfulResults.length
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
