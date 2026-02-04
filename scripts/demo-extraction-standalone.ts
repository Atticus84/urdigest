/**
 * STANDALONE CONTENT EXTRACTION DEMO (No Database Required)
 *
 * This script demonstrates OCR extraction and newsletter generation
 * without requiring database access. Perfect for testing.
 *
 * Usage:
 *   npx tsx scripts/demo-extraction-standalone.ts
 */

import { SavedPost } from '@/types/database'
import { extractTextFromImageUrl, extractTextFromMultipleImages } from '@/lib/content-extraction/ocr'
import { normalizeInstagramPosts, generateSourcesAttribution } from '@/lib/instagram/normalize'
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

  // 2. IMAGE - Motivational quote
  {
    id: 'demo-002',
    user_id: 'demo-user',
    instagram_post_id: 'DEMO_IMAGE_001',
    instagram_url: 'https://www.instagram.com/p/DEMO002/',
    post_type: 'photo',
    caption: null,
    author_username: 'quotesdaily',
    author_profile_url: null,
    media_urls: null,
    thumbnail_url: 'https://placehold.co/800x800/9b59b6/ffffff?text=Success+is+not+final,+failure+is+not+fatal:+it+is+the+courage+to+continue+that+counts.+-+Winston+Churchill',
    posted_at: new Date('2026-02-04T12:00:00Z').toISOString(),
    saved_at: new Date('2026-02-04T12:15:00Z').toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date('2026-02-04T12:15:00Z').toISOString(),
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

  // 3. REEL - with caption only (no video)
  {
    id: 'demo-003',
    user_id: 'demo-user',
    instagram_post_id: 'DEMO_REEL_001',
    instagram_url: 'https://www.instagram.com/reel/DEMO003/',
    post_type: 'reel',
    caption: '3 productivity hacks that actually work:\n\n1. Time blocking - dedicate specific hours to specific tasks\n2. The 2-minute rule - if it takes less than 2 minutes, do it now\n3. Batch similar tasks together - context switching kills productivity\n\nWhich one will you try first?',
    author_username: 'productivityguru',
    author_profile_url: null,
    media_urls: null,
    thumbnail_url: 'https://placehold.co/800x600/e67e22/ffffff?text=Productivity+Hacks+Reel',
    posted_at: new Date('2026-02-04T14:00:00Z').toISOString(),
    saved_at: new Date('2026-02-04T14:20:00Z').toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date('2026-02-04T14:20:00Z').toISOString(),
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
]

async function runDemo() {
  console.log('═'.repeat(80))
  console.log('🎬 URDIGEST CONTENT EXTRACTION DEMO (Standalone)')
  console.log('═'.repeat(80))
  console.log()

  // Step 1: Run OCR on images
  console.log('📊 STEP 1: OCR EXTRACTION')
  console.log('─'.repeat(80))

  for (let i = 0; i < demoPosts.length; i++) {
    const post = demoPosts[i]
    console.log(`\nProcessing Post ${i + 1}: ${post.post_type?.toUpperCase()}`)

    if (post.post_type === 'carousel' && post.media_urls) {
      const imageUrls = Array.isArray(post.media_urls) ? post.media_urls : []
      console.log(`  Running OCR on ${imageUrls.length} images...`)

      const ocrResult = await extractTextFromMultipleImages(imageUrls)

      if (ocrResult.success && ocrResult.text) {
        post.ocr_text = ocrResult.text
        post.content_confidence = 'high'
        post.sources_used = { transcript: false, ocr: true, caption: Boolean(post.caption), metadata: true }
        console.log(`  ✅ OCR Success: ${ocrResult.text.length} characters extracted`)
        console.log(`  Preview: "${ocrResult.text.slice(0, 100)}..."`)
      } else {
        console.log(`  ❌ OCR Failed: ${ocrResult.error}`)
      }
    } else if (post.post_type === 'photo' && post.thumbnail_url) {
      console.log(`  Running OCR on single image...`)

      const ocrResult = await extractTextFromImageUrl(post.thumbnail_url)

      if (ocrResult.success && ocrResult.text) {
        post.ocr_text = ocrResult.text
        post.content_confidence = 'high'
        post.sources_used = { transcript: false, ocr: true, caption: Boolean(post.caption), metadata: true }
        console.log(`  ✅ OCR Success: ${ocrResult.text.length} characters extracted`)
        console.log(`  Preview: "${ocrResult.text.slice(0, 100)}..."`)
      } else {
        console.log(`  ❌ OCR Failed: ${ocrResult.error}`)
      }
    } else {
      console.log(`  Skipping OCR (not image/carousel)`)
      post.sources_used = { transcript: false, ocr: false, caption: Boolean(post.caption), metadata: true }
      post.content_confidence = post.caption ? 'medium' : 'low'
    }
  }

  // Step 2: Normalize posts
  console.log()
  console.log('─'.repeat(80))
  console.log('🔄 STEP 2: NORMALIZING POSTS')
  console.log('─'.repeat(80))

  const normalizedItems = normalizeInstagramPosts(demoPosts)
  console.log(`✓ Normalized ${normalizedItems.length} posts`)

  normalizedItems.forEach((item, i) => {
    console.log(`\nItem ${i + 1}:`)
    console.log(`  Type: ${item.igType}`)
    console.log(`  Confidence: ${item.confidence}`)
    console.log(`  Has transcript: ${Boolean(item.transcriptText)}`)
    console.log(`  Has OCR: ${Boolean(item.ocrText)}`)
    console.log(`  Has caption: ${Boolean(item.captionText)}`)
    console.log(`  Sources attribution: ${generateSourcesAttribution(item)}`)

    if (item.ocrText) {
      console.log(`  OCR text (${item.ocrText.length} chars): "${item.ocrText.slice(0, 80)}..."`)
    }
  })

  // Step 3: Generate newsletter
  console.log()
  console.log('─'.repeat(80))
  console.log('📰 STEP 3: GENERATING NEWSLETTER')
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
    if (section.lede) {
      console.log(`  Lede: "${section.lede.slice(0, 100)}..."`)
    }
    console.log(`  Takeaways: ${section.takeaways?.length || 0}`)
  })

  // Step 4: Render HTML
  console.log()
  console.log('─'.repeat(80))
  console.log('🎨 STEP 4: RENDERING HTML EMAIL')
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

  // Step 5: Save outputs
  console.log()
  console.log('─'.repeat(80))
  console.log('💾 STEP 5: SAVING OUTPUTS')
  console.log('─'.repeat(80))

  const outputDir = process.cwd()

  // Save HTML
  const htmlPath = path.join(outputDir, 'demo-digest-with-extraction.html')
  fs.writeFileSync(htmlPath, html, 'utf-8')
  console.log(`✓ HTML saved: ${htmlPath}`)

  // Save structured output
  const structuredOutput = {
    extraction_proof: normalizedItems.map((item, i) => ({
      post_id: item.id,
      type: item.igType,
      confidence: item.confidence,
      sources_attribution: generateSourcesAttribution(item),
      has_transcript: Boolean(item.transcriptText),
      has_ocr: Boolean(item.ocrText),
      has_caption: Boolean(item.captionText),
      transcript_text: item.transcriptText,
      ocr_text: item.ocrText,
      caption_text: item.captionText,
      extracted_summary: item.extractedTextSummary,
    })),
    newsletter_sections: newsletter.sections.map(s => ({
      headline: s.headline,
      title: s.title,
      lede: s.lede,
      takeaways: s.takeaways,
      sources_attribution: s.sources_attribution,
      type: s.content_type_label,
    })),
  }

  const jsonPath = path.join(outputDir, 'demo-extraction-proof.json')
  fs.writeFileSync(jsonPath, JSON.stringify(structuredOutput, null, 2), 'utf-8')
  console.log(`✓ Structured output saved: ${jsonPath}`)

  // Print proof
  console.log()
  console.log('═'.repeat(80))
  console.log('✅ EXTRACTION PROOF')
  console.log('═'.repeat(80))
  console.log()

  structuredOutput.extraction_proof.forEach((proof, i) => {
    console.log(`POST ${i + 1}: ${proof.type}`)
    console.log(`─`.repeat(40))
    console.log(`Sources: ${proof.sources_attribution}`)
    console.log(`Confidence: ${proof.confidence}`)

    if (proof.ocr_text) {
      console.log(`\nOCR TEXT EXTRACTED (${proof.ocr_text.length} chars):`)
      console.log(`"${proof.ocr_text.slice(0, 200)}..."`)
    }

    if (proof.caption_text) {
      console.log(`\nCAPTION (${proof.caption_text.length} chars):`)
      console.log(`"${proof.caption_text.slice(0, 200)}..."`)
    }

    if (!proof.ocr_text && !proof.transcript_text && !proof.caption_text) {
      console.log('\n⚠️  No content extracted (low information)')
    }

    console.log()
  })

  console.log('═'.repeat(80))
  console.log('🎉 DEMO COMPLETE')
  console.log('═'.repeat(80))
  console.log()
  console.log('Files generated:')
  console.log(`  1. ${htmlPath}`)
  console.log(`  2. ${jsonPath}`)
  console.log()
  console.log('Next steps:')
  console.log('  1. Open the HTML file in your browser')
  console.log('  2. Verify "Sources:" line shows OCR ✅ for carousel and image posts')
  console.log('  3. Review JSON file for structured extraction proof')
  console.log()
}

// Run the demo
runDemo().catch((error) => {
  console.error('❌ Demo failed:', error)
  process.exit(1)
})
