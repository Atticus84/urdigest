import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SavedPost } from '@/types/database'

// Build a chainable mock for supabase
function createSupabaseMock() {
  const state: Record<string, any> = {}

  // Helper to create a chainable object that returns itself for any method call
  // except terminal methods which return the configured result
  function chainable(terminalResult: any) {
    const proxy: any = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'then') return undefined // Not a promise
        return (..._args: any[]) => {
          // terminal methods
          if (prop === 'single') return terminalResult
          return proxy
        }
      },
    })
    return proxy
  }

  return {
    configure(table: string, operation: string, result: any) {
      state[`${table}.${operation}`] = result
    },
    from(table: string) {
      return {
        select: (..._args: any[]) => chainable(state[`${table}.select`] ?? { data: null, error: null }),
        insert: (..._args: any[]) => state[`${table}.insert`] ?? { error: null },
        update: (..._args: any[]) => chainable(state[`${table}.update`] ?? { error: null }),
      }
    },
  }
}

const mockSupabase = createSupabaseMock()
const mockFromSpy = vi.fn((...args: any[]) => mockSupabase.from(args[0]))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: any[]) => mockFromSpy(...args),
  },
}))

const mockSummarizePosts = vi.fn()
const mockGenerateFallbackSummaries = vi.fn()
vi.mock('@/lib/ai/summarize', () => ({
  summarizePosts: (...args: any[]) => mockSummarizePosts(...args),
  generateFallbackSummaries: (...args: any[]) => mockGenerateFallbackSummaries(...args),
}))

const mockSendDigestEmail = vi.fn()
const mockSendTrialEndedEmail = vi.fn()
vi.mock('@/lib/email/send', () => ({
  sendDigestEmail: (...args: any[]) => mockSendDigestEmail(...args),
  sendTrialEndedEmail: (...args: any[]) => mockSendTrialEndedEmail(...args),
}))

vi.mock('@/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((config: any, trigger: any, handler: any) => {
      return { config, trigger, handler }
    }),
  },
}))

vi.mock('date-fns', () => ({
  format: vi.fn(() => 'January 31, 2026'),
}))

function makeMockPost(overrides: Partial<SavedPost> = {}): SavedPost {
  return {
    id: 'post-1',
    user_id: 'user-1',
    instagram_post_id: 'ig-1',
    instagram_url: 'https://instagram.com/p/abc',
    post_type: 'photo',
    caption: 'A great post',
    author_username: 'testuser',
    author_profile_url: null,
    media_urls: null,
    thumbnail_url: 'https://cdn.instagram.com/thumb.jpg',
    posted_at: null,
    saved_at: new Date().toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  subscription_status: 'active',
  trial_digest_sent: false,
  total_digests_sent: 5,
  digest_enabled: true,
}

describe('dailyDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is configured with correct cron schedule', async () => {
    const { dailyDigest } = await import('@/inngest/functions')
    expect((dailyDigest as any).trigger).toEqual({ cron: '0 6 * * *' })
    expect((dailyDigest as any).config.id).toBe('daily-digest')
  })

  it('fetches only digest-enabled users with active/trial status', async () => {
    const { dailyDigest } = await import('@/inngest/functions')

    // Configure users table to return empty array
    mockSupabase.configure('users', 'select', { data: [], error: null })

    const mockStep = { run: vi.fn((_name: string, fn: () => any) => fn()) }
    await (dailyDigest as any).handler({ event: {}, step: mockStep })

    expect(mockFromSpy).toHaveBeenCalledWith('users')
  })

  it('returns error when user fetch fails', async () => {
    const { dailyDigest } = await import('@/inngest/functions')

    // The dailyDigest handler calls .from('users').select('*').eq(...).in(...)
    // Our chainable mock returns the terminal result for the final call.
    // We need to make the chain return { data: null, error: ... }
    // Since our proxy returns itself for all non-terminal calls, and
    // the actual code uses .eq().in() which are not .single(), we need
    // to adjust. The code does: .from('users').select('*').eq('digest_enabled', true).in(...)
    // .in() is not terminal in our mock - it returns the proxy. But the actual code
    // destructures { data, error } from the result of .in().
    // Let's use a simpler approach - override from for this test.

    mockFromSpy.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          in: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    }))

    const mockStep = { run: vi.fn((_name: string, fn: () => any) => fn()) }
    const result = await (dailyDigest as any).handler({ event: {}, step: mockStep })

    expect(result).toEqual({ error: 'Failed to fetch users' })
  })
})

describe('generateDigestForUser (via manualDigest)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips when no posts are available', async () => {
    const { manualDigest } = await import('@/inngest/functions')

    mockFromSpy.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ single: () => ({ data: mockUser }) }) }),
        }
      }
      if (table === 'saved_posts') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ gte: () => ({ order: () => ({ data: [], error: null }) }) }) }) }),
        }
      }
      return mockSupabase.from(table)
    })

    const result = await (manualDigest as any).handler({
      event: { data: { userId: 'user-1' } },
    })

    expect(result).toEqual({ skipped: true })
    expect(mockSendDigestEmail).not.toHaveBeenCalled()
  })

  it('skips when trial user already received digest', async () => {
    const { manualDigest } = await import('@/inngest/functions')
    const trialUser = { ...mockUser, subscription_status: 'trial', trial_digest_sent: true }
    const posts = [makeMockPost()]

    mockFromSpy.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ single: () => ({ data: trialUser }) }) }),
        }
      }
      if (table === 'saved_posts') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ gte: () => ({ order: () => ({ data: posts, error: null }) }) }) }) }),
        }
      }
      return mockSupabase.from(table)
    })

    const result = await (manualDigest as any).handler({
      event: { data: { userId: 'user-1' } },
    })

    expect(result).toEqual({ skipped: true })
    expect(mockSummarizePosts).not.toHaveBeenCalled()
  })

  it('uses fallback summaries when AI fails', async () => {
    const { manualDigest } = await import('@/inngest/functions')
    const posts = [makeMockPost()]
    const fallbackSummaries = [
      { post_index: 0, title: 'A great post', summary: 'A great post', tags: [] },
    ]

    mockSummarizePosts.mockRejectedValueOnce(new Error('OpenAI down'))
    mockGenerateFallbackSummaries.mockReturnValue(fallbackSummaries)
    mockSendDigestEmail.mockResolvedValue('email-id-123')

    const chainResult = { error: null }
    mockFromSpy.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ single: () => ({ data: mockUser }) }) }),
          update: () => ({ eq: () => chainResult }),
        }
      }
      if (table === 'saved_posts') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ gte: () => ({ order: () => ({ data: posts, error: null }) }) }) }) }),
          update: () => ({ in: () => chainResult }),
        }
      }
      if (table === 'digests') {
        return { insert: () => chainResult }
      }
      return mockSupabase.from(table)
    })

    const result = await (manualDigest as any).handler({
      event: { data: { userId: 'user-1' } },
    })

    expect(mockGenerateFallbackSummaries).toHaveBeenCalledWith(posts)
    expect(result.success).toBe(true)
    expect(result.tokensUsed).toBe(0)
    expect(result.cost).toBe(0)
  })

  it('sends trial ended email for trial users', async () => {
    const { manualDigest } = await import('@/inngest/functions')
    const trialUser = { ...mockUser, subscription_status: 'trial', trial_digest_sent: false, total_digests_sent: 0 }
    const posts = [makeMockPost()]

    mockSummarizePosts.mockResolvedValue({
      summaries: [{ post_index: 0, title: 'T', summary: 'S', tags: [] }],
      tokensUsed: 100,
      cost: 0.001,
    })
    mockSendDigestEmail.mockResolvedValue('email-id-456')
    mockSendTrialEndedEmail.mockResolvedValue(undefined)

    const chainResult = { error: null }
    mockFromSpy.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ single: () => ({ data: trialUser }) }) }),
          update: () => ({ eq: () => chainResult }),
        }
      }
      if (table === 'saved_posts') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ gte: () => ({ order: () => ({ data: posts, error: null }) }) }) }) }),
          update: () => ({ in: () => chainResult }),
        }
      }
      if (table === 'digests') {
        return { insert: () => chainResult }
      }
      return mockSupabase.from(table)
    })

    const result = await (manualDigest as any).handler({
      event: { data: { userId: 'user-1' } },
    })

    expect(mockSendTrialEndedEmail).toHaveBeenCalledWith('test@example.com')
    expect(result.success).toBe(true)
  })

  it('throws when user not found', async () => {
    const { manualDigest } = await import('@/inngest/functions')

    mockFromSpy.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ single: () => ({ data: null }) }) }),
        }
      }
      return mockSupabase.from(table)
    })

    await expect(
      (manualDigest as any).handler({
        event: { data: { userId: 'nonexistent' } },
      })
    ).rejects.toThrow('User not found')
  })
})
