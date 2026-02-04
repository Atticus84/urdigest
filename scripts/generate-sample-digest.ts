/**
 * Generate sample digest HTML for visual testing
 *
 * Usage:
 *   npx tsx scripts/generate-sample-digest.ts
 *
 * Outputs:
 *   - sample-digest.html (in project root)
 *   - sample-digest-fallback.html (fallback version without AI)
 */

import * as fs from 'fs'
import * as path from 'path'
import { samplePostsQuick } from '../src/lib/fixtures/sample-posts'
import { normalizeInstagramPosts } from '../src/lib/instagram/normalize'
import { generateFallbackNewsletterFromNormalized } from '../src/lib/ai/summarize'
import { DigestEmail } from '../src/emails/digest'

async function generateSampleDigest() {
  console.log('🎨 Generating sample digest HTML...\n')

  // 1. Normalize the sample posts
  console.log('📊 Normalizing posts...')
  const normalizedItems = normalizeInstagramPosts(samplePostsQuick)
  console.log(`   ✓ Normalized ${normalizedItems.length} posts\n`)

  normalizedItems.forEach((item, index) => {
    console.log(`   Post ${index + 1}:`)
    console.log(`     Type: ${item.igType}`)
    console.log(`     Confidence: ${item.confidence}`)
    console.log(`     Creator: ${item.creatorHandle || 'N/A'}`)
    console.log(`     Caption length: ${item.captionText?.length || 0} chars`)
    console.log(`     Media count: ${item.mediaCount}`)
    console.log()
  })

  // 2. Generate fallback newsletter (we'll use fallback since we don't have OpenAI key in test)
  console.log('📝 Generating newsletter content (fallback mode)...')
  const newsletter = generateFallbackNewsletterFromNormalized(normalizedItems)
  console.log(`   ✓ Generated newsletter`)
  console.log(`     Subject: ${newsletter.subject_line}`)
  console.log(`     Sections: ${newsletter.sections.length}`)
  console.log()

  // 3. Render HTML email
  console.log('🎨 Rendering HTML email...')
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
  console.log(`   ✓ Rendered ${html.length} characters of HTML\n`)

  // 4. Write to file
  const outputPath = path.join(process.cwd(), 'sample-digest.html')
  fs.writeFileSync(outputPath, html, 'utf-8')
  console.log(`✅ Sample digest generated successfully!`)
  console.log(`   📁 File: ${outputPath}`)
  console.log(`   📏 Size: ${(html.length / 1024).toFixed(2)} KB`)
  console.log()
  console.log('💡 To view: Open the file in your browser')
  console.log()

  // 5. Print newsletter structure for debugging
  console.log('📋 Newsletter Structure:')
  console.log('─'.repeat(60))
  newsletter.sections.forEach((section, i) => {
    console.log(`\nSection ${i + 1}: ${section.headline}`)
    console.log(`  Type: ${section.content_type_label || 'N/A'}`)
    console.log(`  Author: @${section.author_username || 'unknown'}`)
    console.log(`  Has Title: ${section.title ? 'Yes' : 'No'}`)
    console.log(`  Has Lede: ${section.lede ? 'Yes' : 'No'}`)
    console.log(`  Takeaways: ${section.takeaways?.length || 0}`)
    if (section.takeaways && section.takeaways.length > 0) {
      section.takeaways.forEach((t, ti) => {
        console.log(`    ${ti + 1}. ${t}`)
      })
    }
  })
  console.log('\n' + '─'.repeat(60))
}

// Run the generator
generateSampleDigest().catch((error) => {
  console.error('❌ Error generating sample digest:', error)
  process.exit(1)
})
