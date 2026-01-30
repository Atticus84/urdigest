import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'urdigest',
  eventKey: process.env.INNGEST_EVENT_KEY,
})
