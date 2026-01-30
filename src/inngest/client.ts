import { Inngest } from 'inngest'

let _inngest: Inngest | null = null

export const inngest = new Proxy({} as Inngest, {
  get(_target, prop) {
    if (!_inngest) {
      _inngest = new Inngest({
        id: 'urdigest',
        eventKey: process.env.INNGEST_EVENT_KEY,
      })
    }
    return (_inngest as any)[prop]
  },
})
