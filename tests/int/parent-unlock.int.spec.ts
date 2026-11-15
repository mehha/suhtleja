import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'

import { DEFAULT_PARENT_PIN } from '@/utilities/parentPin'
import { checkParentPin, isSameOriginRequest } from '@/utilities/parentUnlock'

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

describe('checkParentPin', () => {
  const ownPin = DEFAULT_PARENT_PIN === '4821' ? '4822' : '4821'
  const wrongPin = '9999'
  const hashOf = (pin: string) => bcrypt.hashSync(pin, 4)

  it('takes the account’s PIN', async () => {
    expect(await checkParentPin(hashOf(ownPin), ownPin)).toEqual({ success: true })
    expect(await checkParentPin(hashOf(DEFAULT_PARENT_PIN), DEFAULT_PARENT_PIN)).toEqual({ success: true })
  })

  it('names the starting PIN after a wrong one while the account still has it', async () => {
    const { success, error } = await checkParentPin(hashOf(DEFAULT_PARENT_PIN), wrongPin)
    expect(success).toBe(false)
    expect(error).toBe(`Vale PIN. Uue konto PIN on ${DEFAULT_PARENT_PIN}.`)
  })

  it('gives nothing away once the parent has chosen a PIN', async () => {
    expect(await checkParentPin(hashOf(ownPin), wrongPin)).toEqual({ success: false, error: 'Vale PIN.' })
    expect(await checkParentPin(hashOf(ownPin), DEFAULT_PARENT_PIN)).toEqual({ success: false, error: 'Vale PIN.' })
  })

  it('says so when no PIN is set or the PIN is not four digits', async () => {
    expect((await checkParentPin(null, ownPin)).error).toBe('PIN ei ole seadistatud. Sea PIN profiilis.')
    expect((await checkParentPin(hashOf(ownPin), '12')).error).toBe('PIN peab olema 4 numbrit.')
  })
})
