import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// POST - apply the shareable digests migration
// Protected by ADMIN_SECRET
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const statements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_name TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_description TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS follow_slug TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS sharing_enabled BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS follower_count INTEGER NOT NULL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS digest_followers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      confirmed BOOLEAN NOT NULL DEFAULT false,
      confirmation_token UUID DEFAULT gen_random_uuid(),
      unsubscribe_token UUID DEFAULT gen_random_uuid(),
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      confirmed_at TIMESTAMPTZ,
      unsubscribed_at TIMESTAMPTZ,
      UNIQUE(user_id, email)
    )`,
    `CREATE TABLE IF NOT EXISTS digest_sends (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      digest_id UUID NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
      recipient_email TEXT NOT NULL,
      recipient_type TEXT NOT NULL DEFAULT 'owner',
      resend_email_id TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      opened_at TIMESTAMPTZ
    )`,
    `ALTER TABLE digests ADD COLUMN IF NOT EXISTS sent_to_followers_count INTEGER NOT NULL DEFAULT 0`,
  ]

  const results: { statement: string; success: boolean; error?: string }[] = []

  for (const sql of statements) {
    const { error } = await supabaseAdmin.rpc('exec_sql' as any, { query: sql } as any)
      .then(() => ({ error: null }))
      .catch((err: any) => ({ error: err }))

    // Try direct query if rpc doesn't work
    if (error) {
      // Use the REST API to run raw SQL via Supabase admin
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': key!,
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({ query: sql }),
        })
        if (!res.ok) {
          // Fallback: use the pg endpoint directly
          const pgRes = await fetch(`${url}/pg`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': key!,
              'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({ query: sql }),
          })
          results.push({
            statement: sql.substring(0, 60),
            success: pgRes.ok,
            error: pgRes.ok ? undefined : await pgRes.text(),
          })
        } else {
          results.push({ statement: sql.substring(0, 60), success: true })
        }
      } catch (e: any) {
        results.push({ statement: sql.substring(0, 60), success: false, error: e.message })
      }
    } else {
      results.push({ statement: sql.substring(0, 60), success: true })
    }
  }

  return NextResponse.json({ results })
}
