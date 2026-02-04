import { SavedPost } from '@/types/database'

/**
 * Sample Instagram posts for testing digest generation
 * Represents different content types: Reel, Carousel, Static Post
 */
export const samplePosts: SavedPost[] = [
  // 1. REEL - Marketing strategy video
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    instagram_post_id: 'C5ABC123XYZ',
    instagram_url: 'https://www.instagram.com/reel/C5ABC123XYZ/',
    post_type: 'reel',
    caption: '3 marketing mistakes that are killing your engagement 👀\n\n1. Posting at random times instead of when your audience is actually online\n2. Using generic captions that could work for any brand\n3. Ignoring comments for the first hour after posting\n\nThe algorithm rewards fast engagement. If you\'re not responding to comments within the first 60 minutes, you\'re basically telling Instagram your content isn\'t worth showing to more people.\n\nTry this instead: Set a timer for 1 hour after posting and dedicate that time ONLY to engaging with every single comment. Watch your reach explode.\n\nSave this for later 📌\n\n#marketingtips #socialmediamarketing #contentcreator #instagramgrowth',
    author_username: 'marketingwithsarah',
    author_profile_url: 'https://www.instagram.com/marketingwithsarah',
    media_urls: null,
    thumbnail_url: 'https://placehold.co/600x400/e74c3c/ffffff?text=Marketing+Reel',
    posted_at: new Date('2026-02-03T14:30:00Z').toISOString(),
    saved_at: new Date('2026-02-03T15:45:00Z').toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date('2026-02-03T15:45:00Z').toISOString(),
  },

  // 2. CAROUSEL - Design inspiration with multiple images
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    instagram_post_id: 'C5DEF456UVW',
    instagram_url: 'https://www.instagram.com/p/C5DEF456UVW/',
    post_type: 'carousel',
    caption: '5 UI patterns that actually convert 🎯\n\nSwipe through for examples from top SaaS companies ->\n\n1. Progressive disclosure (Notion)\n2. Empty states that guide action (Figma)\n3. Sticky CTAs that follow scroll (Linear)\n4. Skeleton loaders instead of spinners (Stripe)\n5. Inline validation with helpful errors (Vercel)\n\nWhat these all have in common: They reduce friction and guide users toward success.\n\nDesign isn\'t just about looking good. It\'s about removing obstacles between your user and their goal.\n\nWhich pattern are you going to implement first? 👇',
    author_username: 'designsystems.io',
    author_profile_url: 'https://www.instagram.com/designsystems.io',
    media_urls: [
      'https://placehold.co/600x600/3498db/ffffff?text=UI+Pattern+1',
      'https://placehold.co/600x600/2ecc71/ffffff?text=UI+Pattern+2',
      'https://placehold.co/600x600/f39c12/ffffff?text=UI+Pattern+3',
      'https://placehold.co/600x600/9b59b6/ffffff?text=UI+Pattern+4',
      'https://placehold.co/600x600/1abc9c/ffffff?text=UI+Pattern+5',
    ],
    thumbnail_url: 'https://placehold.co/600x600/3498db/ffffff?text=UI+Pattern+1',
    posted_at: new Date('2026-02-03T10:15:00Z').toISOString(),
    saved_at: new Date('2026-02-03T11:20:00Z').toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date('2026-02-03T11:20:00Z').toISOString(),
  },

  // 3. STATIC IMAGE POST - Motivational quote with minimal caption
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    instagram_post_id: 'C5GHI789RST',
    instagram_url: 'https://www.instagram.com/p/C5GHI789RST/',
    post_type: 'photo',
    caption: 'Needed this reminder today 💫',
    author_username: 'dailywisdom',
    author_profile_url: 'https://www.instagram.com/dailywisdom',
    media_urls: null,
    thumbnail_url: 'https://placehold.co/600x600/95a5a6/ffffff?text=Motivational+Quote',
    posted_at: new Date('2026-02-03T08:00:00Z').toISOString(),
    saved_at: new Date('2026-02-03T08:15:00Z').toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date('2026-02-03T08:15:00Z').toISOString(),
  },

  // 4. VIDEO POST (non-reel) - Recipe tutorial
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    instagram_post_id: 'C5JKL012MNO',
    instagram_url: 'https://www.instagram.com/p/C5JKL012MNO/',
    post_type: 'video',
    caption: '30-second pasta that tastes like you spent an hour on it 🍝✨\n\nIngredients:\n- 200g pasta\n- 3 cloves garlic\n- 1/4 cup olive oil\n- Red pepper flakes\n- Parmesan\n- Pasta water (the secret ingredient!)\n\nThe trick? Save that starchy pasta water. It\'s what turns oil into a silky sauce that clings to every strand.\n\nNo cream needed. No complicated techniques. Just good ingredients and proper technique.\n\nTry it tonight and let me know what you think! 👨‍🍳',
    author_username: 'quickbites.chef',
    author_profile_url: 'https://www.instagram.com/quickbites.chef',
    media_urls: null,
    thumbnail_url: 'https://placehold.co/600x400/e67e22/ffffff?text=Pasta+Recipe',
    posted_at: new Date('2026-02-03T18:30:00Z').toISOString(),
    saved_at: new Date('2026-02-03T19:00:00Z').toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date('2026-02-03T19:00:00Z').toISOString(),
  },

  // 5. POST with NO CAPTION - Visual only (low confidence scenario)
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    instagram_post_id: 'C5PQR345STU',
    instagram_url: 'https://www.instagram.com/p/C5PQR345STU/',
    post_type: 'photo',
    caption: null, // No caption - tests low-confidence handling
    author_username: 'minimalist.aesthetics',
    author_profile_url: 'https://www.instagram.com/minimalist.aesthetics',
    media_urls: null,
    thumbnail_url: 'https://placehold.co/600x600/34495e/ffffff?text=Minimal+Visual',
    posted_at: new Date('2026-02-03T16:00:00Z').toISOString(),
    saved_at: new Date('2026-02-03T16:30:00Z').toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date('2026-02-03T16:30:00Z').toISOString(),
  },

  // 6. CAROUSEL with LIMITED INFO - Tests medium confidence
  {
    id: '550e8400-e29b-41d4-a716-446655440006',
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    instagram_post_id: 'C5VWX678YZA',
    instagram_url: 'https://www.instagram.com/p/C5VWX678YZA/',
    post_type: 'carousel',
    caption: 'Weekend vibes 🌊',
    author_username: null, // No author - tests fallback behavior
    author_profile_url: null,
    media_urls: [
      'https://placehold.co/600x600/16a085/ffffff?text=Beach+1',
      'https://placehold.co/600x600/27ae60/ffffff?text=Beach+2',
      'https://placehold.co/600x600/2980b9/ffffff?text=Beach+3',
    ],
    thumbnail_url: 'https://placehold.co/600x600/16a085/ffffff?text=Beach+1',
    posted_at: new Date('2026-02-03T12:00:00Z').toISOString(),
    saved_at: new Date('2026-02-03T13:00:00Z').toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date('2026-02-03T13:00:00Z').toISOString(),
  },
]

/**
 * Subset for quick testing (just 3 posts: reel, carousel, static)
 */
export const samplePostsQuick: SavedPost[] = [
  samplePosts[0], // Reel
  samplePosts[1], // Carousel
  samplePosts[2], // Static post
]
