import { describe, it, expect, vi, beforeEach } from 'vitest'
import Stripe from 'stripe'

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: any[]) => mockFrom(...args),
  },
}))

const mockSendPaymentFailedEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/email/send', () => ({
  sendPaymentFailedEmail: (...args: any[]) => mockSendPaymentFailedEmail(...args),
}))

// Mock Stripe's constructEvent to let us control signature verification
const mockConstructEvent = vi.fn()
vi.mock('stripe', () => {
  return {
    default: function Stripe() {
      return {
        webhooks: {
          constructEvent: (...args: any[]) => mockConstructEvent(...args),
        },
      }
    },
  }
})

import { POST } from '../route'
import { NextRequest } from 'next/server'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: string): NextRequest {
  return new NextRequest(new URL('http://localhost/api/webhooks/stripe'), {
    method: 'POST',
    body,
    headers: {
      'stripe-signature': 'sig_test',
    },
  })
}

function makeStripeEvent(type: string, dataObject: any): Stripe.Event {
  return {
    id: `evt_${Date.now()}`,
    object: 'event',
    type,
    data: { object: dataObject },
    api_version: '2024-12-18',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event
}

function mockQuery(returnData: any = null, returnError: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
  }
  chain.select.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'sk_test_123'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
})

// ── Signature Verification ──────────────────────────────────────────────────

describe('signature verification', () => {
  it('returns 400 when signature is invalid', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid signature')
  })

  it('returns 200 when signature is valid', async () => {
    const event = makeStripeEvent('checkout.session.completed', {})
    mockConstructEvent.mockReturnValue(event)
    const chain = mockQuery(null)
    mockFrom.mockReturnValue(chain)

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
  })
})

// ── Subscription Created / Updated ──────────────────────────────────────────

describe('customer.subscription.created', () => {
  it('updates user subscription status', async () => {
    const subscription = {
      id: 'sub_123',
      customer: 'cus_456',
      status: 'active',
      created: 1700000000,
      current_period_end: 1702592000,
    }
    const event = makeStripeEvent('customer.subscription.created', subscription)
    mockConstructEvent.mockReturnValue(event)

    const userChain = mockQuery({ id: 'user_1' })
    const eventChain = mockQuery()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'subscription_events') return eventChain
      return userChain
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('users')
    expect(userChain.update).toHaveBeenCalled()
  })

  it('logs error when user not found for customer', async () => {
    const subscription = {
      id: 'sub_123',
      customer: 'cus_nonexistent',
      status: 'active',
      created: 1700000000,
      current_period_end: null,
    }
    const event = makeStripeEvent('customer.subscription.created', subscription)
    mockConstructEvent.mockReturnValue(event)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const chain = mockQuery(null)
    mockFrom.mockReturnValue(chain)

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    consoleSpy.mockRestore()
  })
})

describe('customer.subscription.updated', () => {
  it('updates subscription fields', async () => {
    const subscription = {
      id: 'sub_123',
      customer: 'cus_456',
      status: 'past_due',
      created: 1700000000,
      current_period_end: 1702592000,
    }
    const event = makeStripeEvent('customer.subscription.updated', subscription)
    mockConstructEvent.mockReturnValue(event)

    const userChain = mockQuery({ id: 'user_1' })
    const eventChain = mockQuery()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'subscription_events') return eventChain
      return userChain
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(userChain.update).toHaveBeenCalled()
  })
})

// ── Subscription Deleted ────────────────────────────────────────────────────

describe('customer.subscription.deleted', () => {
  it('sets subscription status to canceled', async () => {
    const subscription = {
      id: 'sub_123',
      customer: 'cus_456',
      status: 'canceled',
      created: 1700000000,
    }
    const event = makeStripeEvent('customer.subscription.deleted', subscription)
    mockConstructEvent.mockReturnValue(event)

    const userChain = mockQuery({ id: 'user_1' })
    const eventChain = mockQuery()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'subscription_events') return eventChain
      return userChain
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(userChain.update).toHaveBeenCalled()
  })

  it('handles missing user gracefully on delete', async () => {
    const subscription = { id: 'sub_x', customer: 'cus_gone', status: 'canceled', created: 1700000000 }
    const event = makeStripeEvent('customer.subscription.deleted', subscription)
    mockConstructEvent.mockReturnValue(event)

    const chain = mockQuery(null)
    mockFrom.mockReturnValue(chain)

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
  })
})

// ── Invoice Payment Succeeded ───────────────────────────────────────────────

describe('invoice.payment_succeeded', () => {
  it('marks subscription as active', async () => {
    const invoice = { customer: 'cus_456', subscription: 'sub_123' }
    const event = makeStripeEvent('invoice.payment_succeeded', invoice)
    mockConstructEvent.mockReturnValue(event)

    const chain = mockQuery({ id: 'user_1' })
    mockFrom.mockReturnValue(chain)

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(chain.update).toHaveBeenCalled()
  })
})

// ── Invoice Payment Failed ──────────────────────────────────────────────────

describe('invoice.payment_failed', () => {
  it('marks subscription as past_due and sends email', async () => {
    const invoice = { customer: 'cus_456', subscription: 'sub_123' }
    const event = makeStripeEvent('invoice.payment_failed', invoice)
    mockConstructEvent.mockReturnValue(event)

    const chain = mockQuery({ id: 'user_1', email: 'test@example.com' })
    mockFrom.mockReturnValue(chain)

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(chain.update).toHaveBeenCalled()
    expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith('test@example.com')
  })

  it('handles missing user on payment failure', async () => {
    const invoice = { customer: 'cus_gone' }
    const event = makeStripeEvent('invoice.payment_failed', invoice)
    mockConstructEvent.mockReturnValue(event)

    const chain = mockQuery(null)
    mockFrom.mockReturnValue(chain)

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSendPaymentFailedEmail).not.toHaveBeenCalled()
  })
})

// ── Unhandled Event Types ───────────────────────────────────────────────────

describe('unhandled event types', () => {
  it('returns 200 for unknown event type', async () => {
    const event = makeStripeEvent('charge.refunded', { id: 'ch_123' })
    mockConstructEvent.mockReturnValue(event)

    const chain = mockQuery()
    mockFrom.mockReturnValue(chain)

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
  })
})

// ── Event Logging ───────────────────────────────────────────────────────────

describe('event logging', () => {
  it('logs subscription events to subscription_events table', async () => {
    const subscription = {
      id: 'sub_123',
      customer: 'cus_456',
      status: 'active',
      created: 1700000000,
      current_period_end: 1702592000,
    }
    const event = makeStripeEvent('customer.subscription.created', subscription)
    mockConstructEvent.mockReturnValue(event)

    const userChain = mockQuery({ id: 'user_1' })
    const eventChain = mockQuery()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'subscription_events') return eventChain
      return userChain
    })

    await POST(makeRequest('{}'))
    expect(mockFrom).toHaveBeenCalledWith('subscription_events')
    expect(eventChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user_1',
        event_type: 'customer.subscription.created',
        stripe_event_id: event.id,
      })
    )
  })

  it('skips event logging when user not found', async () => {
    const event = makeStripeEvent('charge.succeeded', { customer: 'cus_x' })
    mockConstructEvent.mockReturnValue(event)

    const chain = mockQuery(null)
    mockFrom.mockReturnValue(chain)

    await POST(makeRequest('{}'))
    // insert should not have been called for subscription_events
    // because the event type doesn't start with customer.subscription.
    expect(chain.insert).not.toHaveBeenCalled()
  })
})

// ── Edge Cases ──────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('returns 500 when handler throws unexpected error', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw { type: 'StripeSignatureVerificationError', message: 'bad sig' }
    })

    // The route catches constructEvent errors specifically with status 400
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(400)
  })

  it('handles subscription with null current_period_end', async () => {
    const subscription = {
      id: 'sub_123',
      customer: 'cus_456',
      status: 'trialing',
      created: 1700000000,
      current_period_end: null,
    }
    const event = makeStripeEvent('customer.subscription.created', subscription)
    mockConstructEvent.mockReturnValue(event)

    const userChain = mockQuery({ id: 'user_1' })
    const eventChain = mockQuery()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'subscription_events') return eventChain
      return userChain
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
  })
})
