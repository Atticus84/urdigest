/**
 * END-TO-END CONTENT EXTRACTION DEMO
 *
 * This script demonstrates the full content extraction pipeline:
 * 1. Creates sample Instagram posts with real test images
 * 2. Runs enrichment (OCR extraction)
 * 3. Generates newsletter with extracted content
 * 4. Renders final HTML
 * 5. Shows proof of extraction (logs + structured output)
 *
 * Usage:
 *   npx tsx scripts/demo-content-extraction.ts
 */

import { SavedPost } from '@/types/database'
import { enrichInstagramPosts } from '@/lib/content-extraction/enrich'
import { normalizeInstagramPosts } from '@/lib/instagram/normalize'
import { generateFallbackNewsletterFromNormalized } from '@/lib/ai/summarize'
import { DigestEmail } from '@/emails/digest'
import * as fs from 'fs'
import * as path from 'path'

// Demo posts with real testable images containing text
const demoPosts: SavedPost[] = [
  // 1. CAROUSEL - UI design tips with text overlays
  {
    id: 'demo-001',
    user_id: 'demo-user',
    instagram_post_id: 'DEMO_CAROUSEL_001',
    instagram_url: 'https://www.instagram.com/p/DEMO001/',
    post_type: 'carousel',
    caption: '5 UI design principles every designer should know',
    author_username: 'designpro',
    author_profile_url: null,
    media_urls: [
      // These placeholder images have visible text that OCR can extract
      'https://placehold.co/800x800/3498db/ffffff?text=1.+Hierarchy%0A%0AEstablish+clear+visual+hierarchy+using+size,+color,+and+spacing+to+guide+users%27+attention+to+the+most+important+elements',
      'https://placehold.co/800x800/2ecc71/ffffff?text=2.+Contrast%0A%0AUse+sufficient+color+contrast+(4.5:1+for+text)+to+ensure+readability+and+accessibility',
      'https://placehold.co/800x800/e74c3c/ffffff?text=3.+Consistency%0A%0AMaintain+consistent+patterns+in+typography,+spacing,+and+component+design+throughout+your+interface',
    ],
    thumbnail_url: 'https://placehold.co/800x800/3498db/ffffff?text=1.+Hierarchy',
    posted_at: new Date('2026-02-04T10:00:00Z').toISOString(),
    saved_at: new Date('2026-02-04T10:30:00Z').toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date('2026-02-04T10:30:00Z').toISOString(),
    // New fields (will be populated by enrichment)
    transcript_text: null,
    ocr_text: null,
    extracted_metadata: null,
    processing_status: 'pending',
    processing_error: null,
    enrichment_completed_at: null,
    media_downloaded: false,
    media_file_paths: null,
    sources_used: null,
    content_confidence: null,
  },

  // 2. IMAGE - Motivational quote with text
  {
    id: 'demo-002',
    user_id: 'demo-user',
    instagram_post_id: 'DEMO_IMAGE_001',
    instagram_url: 'https://www.instagram.com/p/DEMO002/',
    post_type: 'photo',
    caption: null, // No caption - will rely on OCR
    author_username: 'quotesdaily',
    author_profile_url: null,
    media_urls: null,
    thumbnail_url: 'https://placehold.co/800x800/9b59b6/ffffff?text=%22Success+is+not+final,+failure+is+not+fatal:+it+is+the+courage+to+continue+that+counts.%22%0A%0A-+Winston+Churchill',
    posted_at: new Date('2026-02-04T12:00:00Z').toISOString(),
    saved_at: new Date('2026-02-04T12:15:00Z').toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date('2026-02-04T12:15:00Z').toISOString(),
    // New fields
    transcript_text: null,
    ocr_text: null,
    extracted_metadata: null,
    processing_status: 'pending',
    processing_error: null,
    enrichment_completed_at: null,
    media_downloaded: false,
    media_file_paths: null,
    sources_used: null,
    content_confidence: null,
  },

  // 3. REEL - Video (no actual transcription possible without real video URL)
  {
    id: 'demo-003',
    user_id: 'demo-user',
    instagram_post_id: 'DEMO_REEL_001',
    instagram_url: 'https://www.instagram.com/reel/DEMO003/',
    post_type: 'reel',
    caption: '3 productivity hacks that actually work:\n\n1. Time blocking\n2. The 2-minute rule\n3. Batch similar tasks together\n\nWhich one will you try first?',
    author_username: 'productivityguru',
    author_profile_url: null,
    media_urls: null,
    thumbnail_url: 'https://placehold.co/800x600/e67e22/ffffff?text=Productivity+Hacks+Reel',
    posted_at: new Date('2026-02-04T14:00:00Z').toISOString(),
    saved_at: new Date('2026-02-04T14:20:00Z').toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date('2026-02-04T14:20:00Z').toISOString(),
    // New fields
    transcript_text: null, // Would require actual video file + Whisper
    ocr_text: null,
    extracted_metadata: null,
    processing_status: 'pending',
    processing_error: null,
    enrichment_completed_at: null,
    media_downloaded: false,
    media_file_paths: null,
    sources_used: null,
    content_confidence: null,
  },
]

async function runDemo() {
  console.log('═'.repeat(80))
  console.log('🎬 URDIGEST END-TO-END CONTENT EXTRACTION DEMO')
  console.log('═'.repeat(80))
  console.log()

  // Step 1: Run enrichment
  console.log('📊 STEP 1: ENRICHMENT')
  console.log('─'.repeat(80))
  const enrichmentResults = await enrichInstagramPosts(demoPosts)

  console.log()
  console.log('Enrichment Summary:')
  enrichmentResults.forEach((result, i) => {
    console.log(`\nPost ${i + 1}: ${demoPosts[i].post_type?.toUpperCase()}`)
    console.log(`  Success: ${result.success ? '✅' : '❌'}`)
    console.log(`  Transcript extracted: ${result.transcriptExtracted ? '✅' : '❌'}`)
    console.log(`  OCR extracted: ${result.ocrExtracted ? '✅' : '❌'}`)
    console.log(`  Sources used:`)
    console.log(`    - Transcript: ${result.sourcesUsed.transcript ? '✅' : '❌'}`)
    console.log(`    - OCR: ${result.sourcesUsed.ocr ? '✅' : '❌'}`)
    console.log(`    - Caption: ${result.sourcesUsed.caption ? '✅' : '❌'}`)
    console.log(`  Confidence: ${result.confidence}`)
    console.log(`  Processing time: ${result.processingTimeSeconds.toFixed(2)}s`)

    if (result.transcriptText) {
      console.log(`  Transcript (${result.transcriptText.length} chars): "${result.transcriptText.slice(0, 100)}..."`)
    }
    if (result.ocrText) {
      console.log(`  OCR Text (${result.ocrText.length} chars): "${result.ocrText.slice(0, 100)}..."`)
    }
    if (result.error) {
      console.log(`  Error: ${result.error}`)
    }
  })

  // Step 2: Update demoPosts with enrichment results
  console.log()
  console.log('─'.repeat(80))
  console.log('📝 STEP 2: UPDATING POSTS WITH EXTRACTED CONTENT')
  console.log('─'.repeat(80))

  demoPosts.forEach((post, i) => {
    const result = enrichmentResults[i]
    post.transcript_text = result.transcriptText
    post.ocr_text = result.ocrText
    post.sources_used = result.sourcesUsed
    post.content_confidence = result.confidence
    post.processing_status = result.success ? 'completed' : 'failed'
    post.enrichment_completed_at = new Date().toISOString()
  })

  console.log('✓ Posts updated with enrichment data')

  // Step 3: Normalize posts
  console.log()
  console.log('─'.repeat(80))
  console.log('🔄 STEP 3: NORMALIZING POSTS')
  console.log('─'.repeat(80))

  const normalizedItems = normalizeInstagramPosts(demoPosts)
  console.log(`✓ Normalized ${normalizedItems.length} posts`)

  normalizedItems.forEach((item, i) => {
    console.log(`\nNormalized Item ${i + 1}:`)
    console.log(`  Type: ${item.igType}`)
    console.log(`  Confidence: ${item.confidence}`)
    console.log(`  Has transcript: ${Boolean(item.transcriptText)}`)
    console.log(`  Has OCR: ${Boolean(item.ocrText)}`)
    console.log(`  Has caption: ${Boolean(item.captionText)}`)
    console.log(`  Extracted summary: "${item.extractedTextSummary.slice(0, 100)}..."`)
  })

  // Step 4: Generate newsletter
  console.log()
  console.log('─'.repeat(80))
  console.log('📰 STEP 4: GENERATING NEWSLETTER')
  console.log('─'.repeat(80))

  const newsletter = generateFallbackNewsletterFromNormalized(normalizedItems)
  console.log(`✓ Generated newsletter`)
  console.log(`  Subject: ${newsletter.subject_line}`)
  console.log(`  Sections: ${newsletter.sections.length}`)

  console.log()
  newsletter.sections.forEach((section, i) => {
    console.log(`\nSection ${i + 1}:`)
    console.log(`  Headline: ${section.headline}`)
    console.log(`  Title: ${section.title}`)
    console.log(`  Type: ${section.content_type_label}`)
    console.log(`  Sources: ${section.sources_attribution}`)
    console.log(`  Lede: "${section.lede?.slice(0, 100)}..."`)
    console.log(`  Takeaways: ${section.takeaways?.length || 0}`)
  })

  // Step 5: Render HTML
  console.log()
  console.log('─'.repeat(80))
  console.log('🎨 STEP 5: RENDERING HTML EMAIL')
  console.log('─'.repeat(80))

  const html = DigestEmail({
    newsletter,
    date: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    postCount: normalizedItems.length,
  })

  console.log(`✓ Rendered HTML (${html.length} chars, ${(html.length / 1024).toFixed(2)} KB)`)

  // Step 6: Save output
  console.log()
  console.log('─'.repeat(80))
  console.log('💾 STEP 6: SAVING OUTPUTS')
  console.log('─'.repeat(80))

  const outputDir = process.cwd()

  // Save HTML
  const htmlPath = path.join(outputDir, 'demo-digest-with-extraction.html')
  fs.writeFileSync(htmlPath, html, 'utf-8')
  console.log(`✓ HTML saved: ${htmlPath}`)

  // Save structured output (JSON)
  const structuredOutput = {
    enrichmentResults,
    normalizedItems: normalizedItems.map(item => ({
      id: item.id,
      type: item.igType,
      confidence: item.confidence,
      hasTranscript: Boolean(item.transcriptText),
      hasOCR: Boolean(item.ocrText),
      hasCaption: Boolean(item.captionText),
      transcriptText: item.transcriptText,
      ocrText: item.ocrText,
      extractedSummary: item.extractedTextSummary,
    })),
    newsletter: {
      subject: newsletter.subject_line,
      greeting: newsletter.greeting,
      sections: newsletter.sections.map(s => ({
        headline: s.headline,
        title: s.title,
        lede: s.lede,
        takeaways: s.takeaways,
        sources: s.sources_attribution,
        type: s.content_type_label,
      })),
      bigPicture: newsletter.big_picture,
    },
  }

  const jsonPath = path.join(outputDir, 'demo-digest-structured.json')
  fs.writeFileSync(jsonPath, JSON.stringify(structuredOutput, null, 2), 'utf-8')
  console.log(`✓ Structured output saved: ${jsonPath}`)

  // Print proof
  console.log()
  console.log('═'.repeat(80))
  console.log('✅ PROOF OF CONTENT EXTRACTION')
  console.log('═'.repeat(80))
  console.log()

  console.log('OCR EXTRACTION PROOF:')
  console.log('─'.repeat(80))
  normalizedItems.forEach((item, i) => {
    if (item.ocrText) {
      console.log(`\nPost ${i + 1} (${item.igType}):`)
      console.log(`  OCR Text Length: ${item.ocrText.length} characters`)
      console.log(`  First 200 chars: "${item.ocrText.slice(0, 200)}..."`)
      console.log(`  Used in summary: ${newsletter.sections[i].sources_attribution?.includes('OCR ✅')}`)
    }
  })

  console.log()
  console.log('SOURCES ATTRIBUTION IN EMAIL:')
  console.log('─'.repeat(80))
  newsletter.sections.forEach((section, i) => {
    console.log(`\nSection ${i + 1}: ${section.title}`)
    console.log(`  Sources: ${section.sources_attribution}`)
  })

  console.log()
  console.log('═'.repeat(80))
  console.log('🎉 DEMO COMPLETE')
  console.log('═'.repeat(80))
  console.log()
  console.log('Next steps:')
  console.log(`  1. Open ${htmlPath} in your browser to see the email`)
  console.log(`  2. Review ${jsonPath} for structured data`)
  console.log('  3. Check console output above for extraction proof')
  console.log()
}

// Run the demo
runDemo().catch((error) => {
  console.error('❌ Demo failed:', error)
  process.exit(1)
})
