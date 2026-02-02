import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Simple admin secret check — set ADMIN_SECRET env var
function isAuthorized(request: NextRequest): boolean {
  const secret = request.nextUrl.searchParams.get('secret')
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    // If no secret configured, deny access
    return false
  }
  return secret === adminSecret
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, any> = {}

  // 1. Test Instagram token
  try {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
    const pageId = process.env.INSTAGRAM_PAGE_ID || 'me'

    if (!accessToken) {
      results.instagram_token = { status: 'error', message: 'INSTAGRAM_ACCESS_TOKEN not configured' }
    } else {
      // Test the token by calling the debug_token endpoint or a simple me query
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}?fields=id,name,access_token&access_token=${accessToken}`
      )
      const data = await response.json()

      if (data.error) {
        results.instagram_token = {
          status: 'expired',
          error_code: data.error.code,
          error_message: data.error.message,
          error_type: data.error.type,
          token_prefix: accessToken.substring(0, 6) + '...',
          token_length: accessToken.length,
        }
      } else {
        results.instagram_token = {
          status: 'valid',
          page_id: data.id,
          page_name: data.name,
          token_prefix: accessToken.substring(0, 6) + '...',
          token_length: accessToken.length,
        }
      }
    }
  } catch (error) {
    results.instagram_token = {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
  }

  // 2. Check env vars
  results.env_vars = {
    INSTAGRAM_ACCESS_TOKEN: !!process.env.INSTAGRAM_ACCESS_TOKEN,
    INSTAGRAM_PAGE_ID: !!process.env.INSTAGRAM_PAGE_ID,
    INSTAGRAM_APP_SECRET: !!process.env.INSTAGRAM_APP_SECRET,
    INSTAGRAM_DISABLE_MESSAGES: process.env.INSTAGRAM_DISABLE_MESSAGES || 'not set',
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    ADMIN_SECRET: !!process.env.ADMIN_SECRET,
  }

  // 3. User stats
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, instagram_user_id, instagram_username, onboarding_state, digest_enabled, subscription_status, total_posts_saved, total_digests_sent, last_post_received_at, created_at, digest_time, timezone')
      .order('created_at', { ascending: false })

    if (error) {
      results.users = { error: error.message }
    } else {
      results.users = {
        total: users?.length || 0,
        by_onboarding_state: {
          awaiting_email: users?.filter(u => u.onboarding_state === 'awaiting_email').length || 0,
          awaiting_time: users?.filter(u => u.onboarding_state === 'awaiting_time').length || 0,
          onboarded: users?.filter(u => u.onboarding_state === 'onboarded').length || 0,
          null_state: users?.filter(u => !u.onboarding_state).length || 0,
        },
        by_subscription: {
          trial: users?.filter(u => u.subscription_status === 'trial').length || 0,
          active: users?.filter(u => u.subscription_status === 'active').length || 0,
          canceled: users?.filter(u => u.subscription_status === 'canceled').length || 0,
          past_due: users?.filter(u => u.subscription_status === 'past_due').length || 0,
        },
        digest_enabled_count: users?.filter(u => u.digest_enabled).length || 0,
        list: users?.map(u => ({
          id: u.id,
          email: u.email,
          instagram_username: u.instagram_username || null,
          instagram_user_id: u.instagram_user_id || null,
          onboarding_state: u.onboarding_state,
          digest_enabled: u.digest_enabled,
          subscription_status: u.subscription_status,
          total_posts_saved: u.total_posts_saved,
          total_digests_sent: u.total_digests_sent,
          last_post_received_at: u.last_post_received_at,
          digest_time: u.digest_time,
          timezone: u.timezone,
          created_at: u.created_at,
        })),
      }
    }
  } catch (error) {
    results.users = { error: error instanceof Error ? error.message : String(error) }
  }

  // 4. Recent posts
  try {
    const { data: posts, error } = await supabaseAdmin
      .from('saved_posts')
      .select('id, user_id, instagram_url, processed, saved_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      results.recent_posts = { error: error.message }
    } else {
      const { count: totalPosts } = await supabaseAdmin
        .from('saved_posts')
        .select('id', { count: 'exact', head: true })

      const { count: unprocessedPosts } = await supabaseAdmin
        .from('saved_posts')
        .select('id', { count: 'exact', head: true })
        .eq('processed', false)

      results.recent_posts = {
        total: totalPosts || 0,
        unprocessed: unprocessedPosts || 0,
        latest_20: posts,
      }
    }
  } catch (error) {
    results.recent_posts = { error: error instanceof Error ? error.message : String(error) }
  }

  // 5. Recent digests
  try {
    const { data: digests, error } = await supabaseAdmin
      .from('digests')
      .select('id, user_id, subject, post_count, sent_at, opened_at')
      .order('sent_at', { ascending: false })
      .limit(10)

    if (error) {
      results.recent_digests = { error: error.message }
    } else {
      const { count: totalDigests } = await supabaseAdmin
        .from('digests')
        .select('id', { count: 'exact', head: true })

      results.recent_digests = {
        total: totalDigests || 0,
        latest_10: digests,
      }
    }
  } catch (error) {
    results.recent_digests = { error: error instanceof Error ? error.message : String(error) }
  }

  results.checked_at = new Date().toISOString()

  return NextResponse.json(results)
}
