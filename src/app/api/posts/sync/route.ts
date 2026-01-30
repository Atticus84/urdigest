import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const PostSchema = z.object({
  instagram_post_id: z.string(),
  instagram_url: z.string().url(),
  post_type: z.enum(['photo', 'video', 'carousel', 'reel']).optional(),
  caption: z.string().optional(),
  author_username: z.string().optional(),
  author_profile_url: z.string().url().optional(),
  media_urls: z.array(z.string().url()).optional(),
  thumbnail_url: z.string().url().optional(),
  posted_at: z.string().optional(),
})

const SyncRequestSchema = z.object({
  posts: z.array(PostSchema),
})

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const { posts } = SyncRequestSchema.parse(body)

    let synced = 0
    let duplicates = 0
    const errors: string[] = []

    // Insert posts
    for (const post of posts) {
      const { error } = await supabase
        .from('saved_posts')
        .insert({
          user_id: user.id,
          instagram_post_id: post.instagram_post_id,
          instagram_url: post.instagram_url,
          post_type: post.post_type || null,
          caption: post.caption || null,
          author_username: post.author_username || null,
          author_profile_url: post.author_profile_url || null,
          media_urls: (post.media_urls || null) as any,
          thumbnail_url: post.thumbnail_url || null,
          posted_at: post.posted_at || null,
        })

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation (duplicate)
          duplicates++
        } else {
          errors.push(`Failed to save post ${post.instagram_post_id}: ${error.message}`)
        }
      } else {
        synced++
      }
    }

    // Update user stats
    if (synced > 0) {
      const { data: currentUser } = await supabase
        .from('users')
        .select('total_posts_saved')
        .eq('id', user.id)
        .single()

      await supabase
        .from('users')
        .update({
          total_posts_saved: (currentUser?.total_posts_saved || 0) + synced,
          last_post_received_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    }

    return NextResponse.json({
      success: true,
      synced,
      duplicates,
      errors,
    })
  } catch (error) {
    console.error('Sync error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
