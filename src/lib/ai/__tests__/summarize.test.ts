import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SavedPost } from '@/types/database'

const mockCreate = vi.fn()

vi.mock('openai', () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    }
  }
  return { default: MockOpenAI }
})

function makeMockPost(overrides: Partial<SavedPost> = {}): SavedPost {
  return {
    id: 'post-1',
    user_id: 'user-1',
    instagram_post_id: 'ig-1',
    instagram_url: 'https://instagram.com/p/abc',
    post_type: 'photo',
    caption: 'A great post about coding',
    author_username: 'testuser',
    author_profile_url: null,
    media_urls: null,
    thumbnail_url: null,
    posted_at: null,
    saved_at: new Date().toISOString(),
    processed: false,
    processed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('summarizePosts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed summaries from OpenAI response (array format)', async () => {
    const { summarizePosts } = await import('@/lib/ai/summarize')
    const posts = [makeMockPost()]

    const summaryData = [
      {
        post_index: 0,
        title: 'Amazing Coding Tips',
        summary: 'This post shares valuable coding insights.',
        tags: ['coding', 'tips'],
      },
    ]

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(summaryData) } }],
      usage: { total_tokens: 150, prompt_tokens: 100, completion_tokens: 50 },
    })

    const result = await summarizePosts(posts)

    expect(result.summaries).toEqual(summaryData)
    expect(result.tokensUsed).toBe(150)
    expect(result.cost).toBeCloseTo(100 * 0.00015 / 1000 + 50 * 0.0006 / 1000)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
      })
    )
  })

  it('handles object-wrapped summaries response', async () => {
    vi.resetModules()
    const { summarizePosts } = await import('@/lib/ai/summarize')
    const posts = [makeMockPost(), makeMockPost({ id: 'post-2' })]

    const summaryData = [
      { post_index: 0, title: 'Title 1', summary: 'Summary 1', tags: ['a'] },
      { post_index: 1, title: 'Title 2', summary: 'Summary 2', tags: ['b'] },
    ]

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ summaries: summaryData }) } }],
      usage: { total_tokens: 200, prompt_tokens: 120, completion_tokens: 80 },
    })

    const result = await summarizePosts(posts)
    expect(result.summaries).toEqual(summaryData)
  })

  it('throws on mismatched summary count', async () => {
    vi.resetModules()
    const { summarizePosts } = await import('@/lib/ai/summarize')
    const posts = [makeMockPost(), makeMockPost({ id: 'post-2' })]

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify([{ post_index: 0, title: 'T', summary: 'S', tags: [] }]) } }],
      usage: { total_tokens: 100, prompt_tokens: 60, completion_tokens: 40 },
    })

    await expect(summarizePosts(posts)).rejects.toThrow('Expected 2 summaries, got 1')
  })

  it('throws on invalid JSON response', async () => {
    vi.resetModules()
    const { summarizePosts } = await import('@/lib/ai/summarize')

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'not json at all' } }],
      usage: { total_tokens: 50, prompt_tokens: 30, completion_tokens: 20 },
    })

    await expect(summarizePosts([makeMockPost()])).rejects.toThrow('Failed to parse OpenAI response as JSON')
  })

  it('throws when OpenAI API call fails', async () => {
    vi.resetModules()
    const { summarizePosts } = await import('@/lib/ai/summarize')

    mockCreate.mockRejectedValueOnce(new Error('API rate limited'))

    await expect(summarizePosts([makeMockPost()])).rejects.toThrow('API rate limited')
  })

  it('handles zero tokens gracefully', async () => {
    vi.resetModules()
    const { summarizePosts } = await import('@/lib/ai/summarize')
    const posts = [makeMockPost()]

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify([{ post_index: 0, title: 'T', summary: 'S', tags: [] }]) } }],
      usage: undefined,
    })

    const result = await summarizePosts(posts)
    expect(result.tokensUsed).toBe(0)
    expect(result.cost).toBe(0)
  })
})

describe('generateFallbackSummaries', () => {
  it('generates summaries from captions', async () => {
    const { generateFallbackSummaries } = await import('@/lib/ai/summarize')
    const posts = [
      makeMockPost({ caption: 'Short caption' }),
      makeMockPost({ id: 'post-2', caption: 'A'.repeat(80) }),
    ]

    const summaries = generateFallbackSummaries(posts)

    expect(summaries).toHaveLength(2)
    expect(summaries[0].title).toBe('Short caption')
    expect(summaries[0].summary).toBe('Short caption')
    expect(summaries[0].tags).toEqual([])
    expect(summaries[0].post_index).toBe(0)

    expect(summaries[1].title).toHaveLength(63) // 60 + '...'
    expect(summaries[1].title.endsWith('...')).toBe(true)
    expect(summaries[1].summary).toHaveLength(80)
  })

  it('uses post type and author when no caption', async () => {
    const { generateFallbackSummaries } = await import('@/lib/ai/summarize')
    const posts = [
      makeMockPost({ caption: null, post_type: 'reel', author_username: 'creator' }),
    ]

    const summaries = generateFallbackSummaries(posts)
    expect(summaries[0].title).toBe('reel by @creator')
    expect(summaries[0].summary).toBe('No caption available for this post.')
  })

  it('handles missing author and caption', async () => {
    const { generateFallbackSummaries } = await import('@/lib/ai/summarize')
    const posts = [
      makeMockPost({ caption: null, post_type: null, author_username: null }),
    ]

    const summaries = generateFallbackSummaries(posts)
    expect(summaries[0].title).toBe('Post by @unknown')
  })
})
