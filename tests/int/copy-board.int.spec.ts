// @vitest-environment node

// "Tee endale koopia" (src/utilities/copyBoard.ts): a member's own private copy of a board they can
// read. Checked through the Local API with the copying user, like the server action. Every run
// creates its own users and boards and deletes them afterwards.

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Board, User } from '@/payload-types'
import { copyBoardForUser } from '@/utilities/copyBoard'

const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const password = `test-${run}-Passw0rd`

let payload: Payload
type TestUser = User & { collection: 'users' }
let admin: TestUser
let alice: TestUser
let bob: TestUser
let freeUser: TestUser
let shared: Board
let alicePrivate: Board

const created: Array<{ collection: 'users' | 'boards'; id: number }> = []

async function createUser(name: string, role: 'admin' | 'user', membershipStatus: 'active' | 'none'): Promise<TestUser> {
  const doc = await payload.create({
    collection: 'users',
    data: { email: `copy-${name}-${run}@suhtleja.test`, password, name, role, membershipStatus } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'users', id: doc.id })
  return { ...doc, collection: 'users' }
}

const ownerId = (owner: unknown) => (typeof owner === 'object' && owner ? (owner as { id: number }).id : owner)

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  admin = await createUser('admin', 'admin', 'active')
  alice = await createUser('alice', 'user', 'active')
  bob = await createUser('bob', 'user', 'active')
  freeUser = await createUser('free', 'user', 'none')

  shared = await payload.create({
    collection: 'boards',
    data: {
      name: `Ühine ${run}`,
      owner: admin.id,
      visibleToAllUsers: true,
      pinned: true,
      extra: { ai: false, wordClassColors: true, grammar: false },
      grid: {
        cols: 2,
        rows: 1,
        cells: [
          { id: `kaks-${run}`, x: 0, y: 0, w: 1, h: 1, title: 'kaks', wordClass: 'other' },
          { id: `kass-${run}`, x: 1, y: 0, w: 1, h: 1, title: 'kass', wordClass: 'noun', linkBoard: 7 },
        ],
      },
      compounds: [
        {
          id: `kaks-kass-${run}`,
          cells: [{ cellId: `kaks-${run}` }, { cellId: `kass-${run}` }],
          parts: [{ surface: 'kaks' }, { surface: 'kassi' }],
        },
      ],
      ttsCache: { entries: [{ hash: 'abc', key: 'tts/ms/x/abc.mp3', text: 'kass.', source: 'cell' }], updatedAt: '' },
    } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'boards', id: shared.id })

  alicePrivate = await payload.create({
    collection: 'boards',
    data: { name: `Alice ${run}`, owner: alice.id } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'boards', id: alicePrivate.id })
})

afterAll(async () => {
  for (const { collection, id } of created.reverse()) {
    await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
  }
})

describe('copying a board', () => {
  it("makes the member's own private copy of a shared board", async () => {
    const copy = (await copyBoardForUser(payload, bob, shared.id))!
    created.push({ collection: 'boards', id: copy.id })

    expect(copy.name).toBe(`Ühine ${run} (koopia)`)
    expect(ownerId(copy.owner)).toBe(bob.id)
    expect(copy.visibleToAllUsers).toBeFalsy()
    expect(copy.pinned).toBe(false)
    expect(copy.extra?.grammar).toBe(false)

    const cells = copy.grid?.cells ?? []
    expect(cells.map(({ title, wordClass, linkBoard, x }) => ({ title, wordClass, linkBoard, x }))).toEqual([
      { title: 'kaks', wordClass: 'other', linkBoard: null, x: 0 },
      { title: 'kass', wordClass: 'noun', linkBoard: 7, x: 1 },
    ])
    // New card ids, which the compound follows.
    expect(cells.map((cell) => cell.id)).not.toContain(`kaks-${run}`)
    const compound = copy.compounds?.[0]
    expect(compound?.id).not.toBe(`kaks-kass-${run}`)
    expect(compound?.cells?.map((cell) => cell.cellId)).toEqual(cells.map((cell) => cell.id))
    expect(compound?.parts?.map((part) => part.surface)).toEqual(['kaks', 'kassi'])
    // The speech cache comes along: the audio in R2 is keyed by the words.
    expect((copy.ttsCache as { entries: Array<{ hash: string }> }).entries.map((entry) => entry.hash)).toEqual(['abc'])

    // The original is untouched.
    const original = await payload.findByID({ collection: 'boards', id: shared.id, depth: 0, overrideAccess: true })
    expect(original.grid?.cells?.map((cell) => cell.id)).toEqual([`kaks-${run}`, `kass-${run}`])
    expect(ownerId(original.owner)).toBe(admin.id)
  })

  it("can't copy another member's private board", async () => {
    expect(await copyBoardForUser(payload, bob, alicePrivate.id)).toBeNull()
  })

  it('makes nothing for a user without a membership', async () => {
    // Without a membership the board can't be read (and a board can't be made).
    expect(await copyBoardForUser(payload, freeUser, shared.id)).toBeNull()
    const own = await payload.find({ collection: 'boards', where: { owner: { equals: freeUser.id } }, overrideAccess: true })
    expect(own.totalDocs).toBe(0)
  })
})
