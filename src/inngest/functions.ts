import { inngest } from './client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateDigestForUser } from '@/lib/digest/generate'

export const dailyDigest = inngest.createFunction(
  { id: 'daily-digest', name: 'Generate and send daily digests' },
  { cron: '0 6 * * *' }, // Run at 6am daily
  async ({ event, step }) => {
    // Get all users who should receive digests
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('digest_enabled', true)
      .in('subscription_status', ['trial', 'active'])

    if (error || !users) {
      console.error('Failed to fetch users:', error)
      return { error: 'Failed to fetch users' }
    }

    console.log(`Processing digests for ${users.length} users`)

    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
    }

    // Process each user
    for (const user of users) {
      try {
        await step.run(`digest-for-${user.id}`, async () => {
          return await generateDigestForUser(user)
        })
        results.success++
      } catch (error) {
        console.error(`Failed to generate digest for user ${user.id}:`, error)
        results.failed++
      }
    }

    return results
  }
)

// Manual trigger for testing
export const manualDigest = inngest.createFunction(
  { id: 'manual-digest', name: 'Manually trigger digest for a user' },
  { event: 'digest/manual' },
  async ({ event }) => {
    const { userId } = event.data

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (!user) {
      throw new Error('User not found')
    }

    return await generateDigestForUser(user)
  }
)
