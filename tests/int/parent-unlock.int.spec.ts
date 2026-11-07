import { describe, expect, it } from 'vitest'

import { isSameOriginRequest } from '@/utilities/parentUnlock'

const from = (headers: Record<string, string>) => isSameOriginRequest(new Headers(headers))

describe('isSameOriginRequest', () => {
  it("takes the PIN from the site's own pages", () => {
    expect(from({ origin: 'https://suhtleja.ee', host: 'suhtleja.ee' })).toBe(true)
    expect(from({ origin: 'http://localhost:3000', host: 'localhost:3000' })).toBe(true)
  })

  it('compares with the forwarded host behind a proxy', () => {
    expect(
      from({ origin: 'https://suhtleja.ee', host: 'worker.internal', 'x-forwarded-host': 'suhtleja.ee' }),
    ).toBe(true)
  })

  it('turns away a page on another site, which could otherwise unlock with the parent’s login', () => {
    expect(from({ origin: 'https://example.com', host: 'suhtleja.ee' })).toBe(false)
    expect(from({ origin: 'https://suhtleja.ee.example.com', host: 'suhtleja.ee' })).toBe(false)
  })

  it('turns away a request without a usable Origin', () => {
    expect(from({ host: 'suhtleja.ee' })).toBe(false)
    expect(from({ origin: 'null', host: 'suhtleja.ee' })).toBe(false)
  })
})
