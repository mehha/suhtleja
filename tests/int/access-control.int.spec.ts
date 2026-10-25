// @vitest-environment node

// Access rules from docs/rules/project/access-control.md, checked through the Local API with
// `overrideAccess: false` so they behave like REST requests from a logged-in customer.
// Every run creates its own users and documents and deletes them afterwards.

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const email = (name: string) => `access-${name}-${run}@suhtleja.test`
const password = `test-${run}-Passw0rd`

// 1x1 transparent PNG.
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

let payload: Payload
type TestUser = User & { collection: 'users' }
let admin: TestUser
let alice: TestUser // paying customer
let bob: TestUser // paying customer
let freeUser: TestUser // registered, no membership

const created: Array<{ collection: 'users' | 'boards' | 'connect-dots-puzzles' | 'media' | 'pages'; id: number }> = []
const track = <T extends { id: number }>(collection: (typeof created)[number]['collection'], doc: T) => {
  created.push({ collection, id: doc.id })
  return doc
}

const as = (user: TestUser | null) => ({ overrideAccess: false, user, depth: 0 })

async function createUser(name: string, role: 'admin' | 'user', membershipStatus: 'active' | 'none'): Promise<TestUser> {
  const doc = await payload.create({
    collection: 'users',
    data: { email: email(name), password, name, role, membershipStatus } as never,
    overrideAccess: true,
  })
  return { ...track('users', doc), collection: 'users' }
}

const ownerId = (owner: unknown) => (typeof owner === 'object' && owner ? (owner as { id: number }).id : owner)

let aliceBoard: { id: number }
let sharedBoard: { id: number }
let alicePuzzle: { id: number }
let aliceMedia: { id: number }
let draftPage: { id: number; slug?: string | null }

beforeAll(async () => {
  payload = await getPayload({ config: await config })

  admin = await createUser('admin', 'admin', 'active')
  alice = await createUser('alice', 'user', 'active')
  bob = await createUser('bob', 'user', 'active')
  freeUser = await createUser('free', 'user', 'none')

  aliceBoard = track('boards', await payload.create({ collection: 'boards', data: { name: 'Alice private', owner: alice.id } as never, overrideAccess: true }))
  sharedBoard = track(
    'boards',
    await payload.create({ collection: 'boards', data: { name: 'Shared', owner: admin.id, visibleToAllUsers: true } as never, overrideAccess: true }),
  )
  alicePuzzle = track(
    'connect-dots-puzzles',
    await payload.create({
      collection: 'connect-dots-puzzles',
      data: { title: 'Alice puzzle', slug: `access-puzzle-${run}`, owner: alice.id, dots: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }] } as never,
      overrideAccess: true,
    }),
  )
  aliceMedia = track(
    'media',
    await payload.create({
      collection: 'media',
      data: { alt: 'Alice image', owner: alice.id } as never,
      file: { data: tinyPng, mimetype: 'image/png', name: `access-${run}.png`, size: tinyPng.length },
      overrideAccess: true,
    }),
  )
  draftPage = track(
    'pages',
    await payload.create({
      collection: 'pages',
      draft: true,
      data: {
        title: `Access draft ${run}`,
        slug: `access-draft-${run}`,
        _status: 'draft',
        hero: { type: 'none' },
        layout: [{ blockType: 'contact', email: 'test@suhtleja.test' }],
      } as never,
      overrideAccess: true,
      context: { disableRevalidate: true },
    }),
  )
}, 60_000)

afterAll(async () => {
  for (const { collection, id } of created.reverse()) {
    await payload
      .delete({ collection, id, overrideAccess: true, context: { disableRevalidate: true } })
      .catch(() => undefined)
  }
}, 60_000)

describe('users', () => {
  it('a customer only sees their own account', async () => {
    const { docs } = await payload.find({ collection: 'users', ...as(alice) })
    expect(docs.map((doc) => doc.id)).toEqual([alice.id])
    await expect(payload.findByID({ collection: 'users', id: bob.id, ...as(alice) })).rejects.toThrow()
  })

  it('a customer cannot edit or delete another account', async () => {
    await expect(payload.update({ collection: 'users', id: bob.id, data: { name: 'hacked' }, ...as(alice) })).rejects.toThrow()
    await expect(payload.delete({ collection: 'users', id: bob.id, ...as(alice) })).rejects.toThrow()
  })

  it('a customer cannot make themselves admin or give themselves a membership', async () => {
    await payload.update({
      collection: 'users',
      id: freeUser.id,
      data: { role: 'admin', membershipStatus: 'active' } as never,
      ...as(freeUser),
    })
    const after = await payload.findByID({ collection: 'users', id: freeUser.id, overrideAccess: true })
    expect(after.role).toBe('user')
    expect(after.membershipStatus).toBe('none')
  })

  it('sign-up always creates a plain user without membership', async () => {
    const signedUp = track(
      'users',
      await payload.create({
        collection: 'users',
        data: { email: email('signup'), password, name: 'Sign-up', role: 'admin', membershipStatus: 'active' } as never,
        ...as(null),
      }),
    )
    const after = await payload.findByID({ collection: 'users', id: signedUp.id, overrideAccess: true })
    expect(after.role).toBe('user')
    expect(after.membershipStatus ?? 'none').toBe('none')
  })

  it('visitors cannot list users', async () => {
    await expect(payload.find({ collection: 'users', ...as(null) })).rejects.toThrow()
  })
})

describe('pages and site settings', () => {
  it('a customer cannot create, edit or delete pages', async () => {
    const data = { title: 'Hacked', slug: `hacked-${run}`, hero: { type: 'none' }, layout: [{ blockType: 'contact', email: 'x@y.ee' }] }
    await expect(payload.create({ collection: 'pages', data: data as never, ...as(alice) })).rejects.toThrow()
    await expect(payload.update({ collection: 'pages', id: draftPage.id, data: { title: 'Hacked' }, ...as(alice) })).rejects.toThrow()
    await expect(payload.delete({ collection: 'pages', id: draftPage.id, ...as(alice) })).rejects.toThrow()
  })

  it('drafts are hidden from customers and visitors', async () => {
    const where = { slug: { equals: draftPage.slug } }
    expect((await payload.find({ collection: 'pages', where, draft: true, ...as(alice) })).docs).toHaveLength(0)
    expect((await payload.find({ collection: 'pages', where, draft: true, ...as(null) })).docs).toHaveLength(0)
    expect((await payload.find({ collection: 'pages', where, draft: true, ...as(admin) })).docs).toHaveLength(1)
  })

  it('a customer cannot change the header or footer', async () => {
    await expect(payload.updateGlobal({ slug: 'header', data: { navItems: [] }, ...as(alice) })).rejects.toThrow()
    await expect(payload.updateGlobal({ slug: 'footer', data: { navItems: [] }, ...as(alice) })).rejects.toThrow()
  })

  it('a customer cannot read form submissions or create redirects', async () => {
    await expect(payload.find({ collection: 'form-submissions', ...as(alice) })).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'redirects',
        data: { from: `/hacked-${run}`, to: { type: 'custom', url: 'https://example.com' } } as never,
        ...as(alice),
      }),
    ).rejects.toThrow()
  })
})

describe('boards', () => {
  it("another customer cannot read, edit or delete a private board", async () => {
    await expect(payload.findByID({ collection: 'boards', id: aliceBoard.id, ...as(bob) })).rejects.toThrow()
    await expect(payload.update({ collection: 'boards', id: aliceBoard.id, data: { name: 'Hacked' }, ...as(bob) })).rejects.toThrow()
    await expect(payload.delete({ collection: 'boards', id: aliceBoard.id, ...as(bob) })).rejects.toThrow()
  })

  it('a shared board is readable by members but only editable by its owner', async () => {
    await expect(payload.findByID({ collection: 'boards', id: sharedBoard.id, ...as(bob) })).resolves.toBeTruthy()
    await expect(payload.update({ collection: 'boards', id: sharedBoard.id, data: { name: 'Hacked' }, ...as(bob) })).rejects.toThrow()
  })

  it('users without a membership cannot create or read boards', async () => {
    await expect(payload.create({ collection: 'boards', data: { name: 'Free board' } as never, ...as(freeUser) })).rejects.toThrow()
    await expect(payload.find({ collection: 'boards', ...as(freeUser) })).rejects.toThrow()
  })

  it('admins can see a board but not edit its content', async () => {
    await expect(payload.findByID({ collection: 'boards', id: aliceBoard.id, ...as(admin) })).resolves.toBeTruthy()
    await expect(payload.update({ collection: 'boards', id: aliceBoard.id, data: { name: 'Edited by admin' }, ...as(admin) })).rejects.toThrow()
  })

  it('a customer cannot share a board with everyone', async () => {
    const board = track('boards', await payload.create({ collection: 'boards', data: { name: 'Try to share', visibleToAllUsers: true } as never, ...as(alice) }))
    expect(board.visibleToAllUsers).toBe(false)
    const updated = await payload.update({ collection: 'boards', id: board.id, data: { visibleToAllUsers: true } as never, ...as(alice) })
    expect(updated.visibleToAllUsers).toBe(false)
  })

  it("a customer cannot create a board in someone else's name or hand one over", async () => {
    const board = track('boards', await payload.create({ collection: 'boards', data: { name: 'In Bob’s name', owner: bob.id } as never, ...as(alice) }))
    expect(ownerId(board.owner)).toBe(alice.id)
    const updated = await payload.update({ collection: 'boards', id: board.id, data: { owner: bob.id } as never, ...as(alice) })
    expect(ownerId(updated.owner)).toBe(alice.id)
  })
})

describe('connect-dots puzzles', () => {
  it('another customer cannot read, edit or delete a private puzzle', async () => {
    await expect(payload.findByID({ collection: 'connect-dots-puzzles', id: alicePuzzle.id, ...as(bob) })).rejects.toThrow()
    await expect(
      payload.update({ collection: 'connect-dots-puzzles', id: alicePuzzle.id, data: { title: 'Hacked' }, ...as(bob) }),
    ).rejects.toThrow()
    await expect(payload.delete({ collection: 'connect-dots-puzzles', id: alicePuzzle.id, ...as(bob) })).rejects.toThrow()
  })

  it('a customer cannot share a puzzle with everyone', async () => {
    const updated = await payload.update({
      collection: 'connect-dots-puzzles',
      id: alicePuzzle.id,
      data: { visibleToAllUsers: true } as never,
      ...as(alice),
    })
    expect(updated.visibleToAllUsers).toBe(false)
  })

  it("a customer cannot create a puzzle in someone else's name or hand one over", async () => {
    const puzzle = track(
      'connect-dots-puzzles',
      await payload.create({
        collection: 'connect-dots-puzzles',
        data: { title: 'In Bob’s name', slug: `access-puzzle-bob-${run}`, owner: bob.id, visibleToAllUsers: true, dots: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }] } as never,
        ...as(alice),
      }),
    )
    expect(ownerId(puzzle.owner)).toBe(alice.id)
    expect(puzzle.visibleToAllUsers).toBe(false)
    const updated = await payload.update({ collection: 'connect-dots-puzzles', id: puzzle.id, data: { owner: bob.id } as never, ...as(alice) })
    expect(ownerId(updated.owner)).toBe(alice.id)
  })
})

describe('media', () => {
  it("another customer cannot edit or delete someone's media", async () => {
    await expect(payload.update({ collection: 'media', id: aliceMedia.id, data: { alt: 'Hacked' }, ...as(bob) })).rejects.toThrow()
    await expect(payload.delete({ collection: 'media', id: aliceMedia.id, ...as(bob) })).rejects.toThrow()
  })

  it('a customer cannot hand their media over to someone else', async () => {
    const updated = await payload.update({ collection: 'media', id: aliceMedia.id, data: { owner: bob.id } as never, ...as(alice) })
    expect(ownerId(updated.owner)).toBe(alice.id)
  })
})
