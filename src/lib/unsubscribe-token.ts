import crypto from 'crypto'

const SECRET = process.env.UNSUBSCRIBE_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret'

export function generateUnsubscribeToken(email: string): string {
  const hmac = crypto.createHmac('sha256', SECRET)
  hmac.update(email.toLowerCase())
  return hmac.digest('hex')
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = generateUnsubscribeToken(email)
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}
