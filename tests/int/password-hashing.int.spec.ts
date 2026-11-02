// @vitest-environment node

import crypto from 'crypto'
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// Covers patches/payload@3.92.0.patch (backport of payloadcms/payload#19074) and
// auth.passwordHashIterations in payload.config.ts: Cloudflare Workers rejects PBKDF2 above
// 100,000 iterations, which Payload 3.90+ exceeds by default. Open-source workerd does not
// enforce the limit, so the tests simulate it.

const password = 'test-password-123'
const email = `password-hashing-${Date.now()}@example.test`

let payload: Payload
let userId: number | string | undefined

// Matches the error Cloudflare Workers throws for more than 100,000 iterations.
const simulateWorkers = () => {
  const pbkdf2 = crypto.pbkdf2
  vi.spyOn(crypto, 'pbkdf2').mockImplementation(((...args: Parameters<typeof crypto.pbkdf2>) => {
    const iterations = args[2]
    const callback = args[5]
    if (iterations > 100000) {
      callback(
        new DOMException(
          `Pbkdf2 failed: iteration counts above 100000 are not supported (requested ${iterations}).`,
          'NotSupportedError',
        ),
        Buffer.alloc(0),
      )
      return
    }
    pbkdf2(...args)
  }) as typeof crypto.pbkdf2)
}

const getStoredHash = async (): Promise<string> => {
  const user = await payload.findByID({ collection: 'users', id: userId!, showHiddenFields: true })
  return String((user as { hash?: string }).hash)
}

const setStoredHash = async (hash: string, salt: string) => {
  await payload.db.updateOne({
    collection: 'users',
    data: { hash, salt },
    where: { id: { equals: userId } },
  })
}

describe('password hashing on Cloudflare Workers', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    if (userId !== undefined) {
      await payload.delete({ collection: 'users', id: userId })
    }
  })

  it('creates users with 100,000 iterations in the upstream format and lets them log in', async () => {
    simulateWorkers()

    const user = await payload.create({
      collection: 'users',
      data: { email, password, name: 'Parooli Test', role: 'user' },
    })
    userId = user.id

    expect(await getStoredHash()).toMatch(/^pbkdf2-sha256-100k-v1:[0-9a-f]{64}$/)

    const result = await payload.login({ collection: 'users', data: { email, password } })
    expect(result.user?.id).toBe(userId)
  })

  it('upgrades a legacy hash on login', async () => {
    const salt = crypto.randomBytes(32).toString('hex')
    await setStoredHash(crypto.pbkdf2Sync(password, salt, 25000, 512, 'sha256').toString('hex'), salt)

    simulateWorkers()
    const result = await payload.login({ collection: 'users', data: { email, password } })

    expect(result.user?.id).toBe(userId)
    expect(await getStoredHash()).toMatch(/^pbkdf2-sha256-100k-v1:/)
  })

  it('upgrades a hash from the earlier patch (pbkdf2-sha256-v2) on login', async () => {
    const salt = crypto.randomBytes(32).toString('hex')
    const raw = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')
    await setStoredHash(`pbkdf2-sha256-v2-i100000-l32:${raw}`, salt)

    simulateWorkers()
    const result = await payload.login({ collection: 'users', data: { email, password } })

    expect(result.user?.id).toBe(userId)
    expect(await getStoredHash()).toMatch(/^pbkdf2-sha256-100k-v1:/)
  })

  it('keeps a current hash on Node.js and Workers logins', async () => {
    const before = await getStoredHash()

    await payload.login({ collection: 'users', data: { email, password } })
    simulateWorkers()
    await payload.login({ collection: 'users', data: { email, password } })

    expect(await getStoredHash()).toBe(before)
  })

  it('reports a 600,000-iteration hash it cannot verify on Workers', async () => {
    const salt = crypto.randomBytes(32).toString('hex')
    const raw = crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256').toString('hex')
    await setStoredHash(`pbkdf2-sha256-v1:${raw}`, salt)

    simulateWorkers()
    await expect(
      payload.login({ collection: 'users', data: { email, password } }),
    ).rejects.toThrow('The user must reset their password')
  })
})
