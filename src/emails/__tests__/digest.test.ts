import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DigestEmail } from '@/emails/digest'

// Set env for template
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://urdigest.com')

const mockPost = {
  id: 'post-1',
  title: 'Great Coding Tips for 2026',
  summary: 'This post covers the latest coding best practices and tooling.',
  instagram_url: 'https://instagram.com/p/abc123',
  thumbnail_url: 'https://cdn.instagram.com/thumb.jpg',
  author_username: 'devguru',
}

describe('DigestEmail', () => {
  it('renders valid HTML with all post data', () => {
    const html = DigestEmail({
      posts: [mockPost],
      userEmail: 'test@example.com',
      date: 'January 31, 2026',
    })

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Your Daily urdigest')
    expect(html).toContain('January 31, 2026')
    expect(html).toContain('1 post you saved')
    expect(html).toContain('Great Coding Tips for 2026')
    expect(html).toContain('This post covers the latest coding best practices')
    expect(html).toContain('@devguru')
    expect(html).toContain('https://instagram.com/p/abc123')
    expect(html).toContain('View on Instagram')
    expect(html).toContain('https://cdn.instagram.com/thumb.jpg')
  })

  it('renders plural post count', () => {
    const html = DigestEmail({
      posts: [mockPost, { ...mockPost, id: 'post-2' }],
      userEmail: 'test@example.com',
      date: 'January 31, 2026',
    })

    expect(html).toContain('2 posts you saved')
  })

  it('omits thumbnail when null', () => {
    const html = DigestEmail({
      posts: [{ ...mockPost, thumbnail_url: null }],
      userEmail: 'test@example.com',
      date: 'January 31, 2026',
    })

    expect(html).not.toContain('<img')
  })

  it('omits author line when null', () => {
    const html = DigestEmail({
      posts: [{ ...mockPost, author_username: null }],
      userEmail: 'test@example.com',
      date: 'January 31, 2026',
    })

    expect(html).not.toContain('@devguru')
  })

  it('renders dividers between multiple posts but not after last', () => {
    const html = DigestEmail({
      posts: [mockPost, { ...mockPost, id: 'post-2' }, { ...mockPost, id: 'post-3' }],
      userEmail: 'test@example.com',
      date: 'January 31, 2026',
    })

    const hrCount = (html.match(/<hr/g) || []).length
    expect(hrCount).toBe(2)
  })

  it('includes settings and unsubscribe links', () => {
    const html = DigestEmail({
      posts: [mockPost],
      userEmail: 'test@example.com',
      date: 'January 31, 2026',
    })

    expect(html).toContain('https://urdigest.com/dashboard/settings')
    expect(html).toContain('https://urdigest.com/unsubscribe')
    expect(html).toContain('Manage preferences')
    expect(html).toContain('Unsubscribe')
  })

  it('includes footer branding', () => {
    const html = DigestEmail({
      posts: [mockPost],
      userEmail: 'test@example.com',
      date: 'January 31, 2026',
    })

    expect(html).toContain('Made with')
    expect(html).toContain('urdigest')
  })
})
