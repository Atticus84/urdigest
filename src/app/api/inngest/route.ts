import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { dailyDigest, manualDigest } from '@/inngest/functions'

export const dynamic = 'force-dynamic'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    dailyDigest,
    manualDigest,
  ],
})
