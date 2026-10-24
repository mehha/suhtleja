// @vitest-environment node

import crypto from 'crypto'
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// Covers patches/payload@3.92.0.patch: Cloudflare Workers rejects PBKDF2 above
// 100,000 iterations, which Payload 3.90+ exceeds when hashing new passwords.

const password = 'test-password-123'
const email = `password-hashing-${Date.now()}@example.test`

let payload: Payload
let userId: number | string | undefined

const simulateWorkers = () => {
  vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' })

  const pbkdf2 = crypto.pbkdf2
  vi.spyOn(crypto, 'pbkdf2').mockImplementation(((...args: Parameters<typeof crypto.pbkdf2>) => {
    const iterations = args[2]
    const callback = args[5]
    if (iterations > 100000) {
      callback(new Error(`iteration counts above 100000 are not supported (requested ${iterations})`), Buffer.alloc(0))
      return
    }
    pbkdf2(...args)
  }) as typeof crypto.pbkdf2)
}

const getStoredHash = async (): Promise<string> => {
  const user = await payload.findByID({ collection: 'users', id: userId!, showHiddenFields: true })
  return String((user as { hash?: string }).hash)
}

describe('password hashing on Cloudflare Workers', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    if (userId !== undefined) {
      await payload.delete({ collection: 'users', id: userId })
    }
  })

  it('creates users with at most 100,000 iterations and lets them log in', async () => {
    simulateWorkers()

    const user = await payload.create({
      collection: 'users',
      data: { email, password, role: 'user' },
    })
    userId = user.id

    expect(await getStoredHash()).toMatch(/^pbkdf2-sha256-v2-i100000-l32:[0-9a-f]{64}$/)

    const result = await payload.login({ collection: 'users', data: { email, password } })
    expect(result.user?.id).toBe(userId)
  })

  it('upgrades a legacy hash to the Workers format on login', async () => {
    const salt = crypto.randomBytes(32).toString('hex')
    const legacyHash = crypto.pbkdf2Sync(password, salt, 25000, 512, 'sha256').toString('hex')
    await payload.db.updateOne({
      collection: 'users',
      data: { hash: legacyHash, salt },
      where: { id: { equals: userId } },
    })

    simulateWorkers()
    const result = await payload.login({ collection: 'users', data: { email, password } })

    expect(result.user?.id).toBe(userId)
    expect(await getStoredHash()).toMatch(/^pbkdf2-sha256-v2-i100000-l32:/)
  })

  it('verifies a Workers hash on Node.js without rehashing it', async () => {
    const before = await getStoredHash()

    const result = await payload.login({ collection: 'users', data: { email, password } })

    expect(result.user?.id).toBe(userId)
    expect(await getStoredHash()).toBe(before)
  })
})
