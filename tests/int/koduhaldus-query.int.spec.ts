// @vitest-environment node

// Which boards and games Koduhaldus loads (src/utilities/koduhaldusQuery.ts): the own and shared
// ones, and for an admin the other users' private ones only when opened. Checked against the local
// database with rows of the test's own; other rows there don't change what's asserted.

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'
import { othersPrivateWhere, ownOrSharedWhere } from '@/utilities/koduhaldusQuery'

const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

let payload: Payload
type TestUser = User & { collection: 'users' }
let admin: TestUser
let member: TestUser
const ids = { adminBoard: 0, memberPrivate: 0, memberShared: 0, memberPuzzle: 0 }
const created: Array<{ collection: 'users' | 'boards' | 'connect-dots-puzzles'; id: number }> = []

async function createUser(name: string, role: 'admin' | 'user'): Promise<TestUser> {
  const doc = await payload.create({
    collection: 'users',
    data: { email: `kh-${name}-${run}@suhtleja.test`, password: `test-${run}-Passw0rd`, name, role, membershipStatus: 'active' } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'users', id: doc.id })
  return { ...doc, collection: 'users' }
}

async function createBoard(name: string, owner: number, visibleToAllUsers: boolean) {
  const doc = await payload.create({
    collection: 'boards',
    data: { name: `${name} ${run}`, owner, visibleToAllUsers } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'boards', id: doc.id })
  return doc.id
}

const boardIds = async (where: ReturnType<typeof ownOrSharedWhere>) =>
  (await payload.find({ collection: 'boards', where, pagination: false, depth: 0, select: {} })).docs.map((doc) => doc.id)

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  admin = await createUser('admin', 'admin')
  member = await createUser('member', 'user')
  ids.adminBoard = await createBoard('Admini oma', admin.id, false)
  ids.memberPrivate = await createBoard('Liikme privaatne', member.id, false)
  ids.memberShared = await createBoard('Liikme jagatud', member.id, true)

  const puzzle = await payload.create({
    collection: 'connect-dots-puzzles',
    data: {
      title: `Liikme mäng ${run}`,
      slug: `kh-${run}`,
      enabled: true,
      owner: member.id,
      externalImageURL: '/og-image.jpg',
      dots: [
        { x: 0.2, y: 0.3 },
        { x: 0.8, y: 0.3 },
      ],
    } as never,
    overrideAccess: true,
  })
  ids.memberPuzzle = puzzle.id
  created.push({ collection: 'connect-dots-puzzles', id: puzzle.id })
})

afterAll(async () => {
  for (const { collection, id } of created.reverse()) {
    await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
  }
})

describe('what Koduhaldus loads', () => {
  it("gives an admin their own and the shared boards, not other users' private ones", async () => {
    const loaded = await boardIds(ownOrSharedWhere(admin.id))
    expect(loaded).toEqual(expect.arrayContaining([ids.adminBoard, ids.memberShared]))
    expect(loaded).not.toContain(ids.memberPrivate)
  })

  it("finds the other users' private boards for the admin to open", async () => {
    const others = await boardIds(othersPrivateWhere(admin.id))
    expect(others).toContain(ids.memberPrivate)
    expect(others).not.toContain(ids.memberShared)
    expect(others).not.toContain(ids.adminBoard)
  })

  it("counts the other users' private games with the admin's access", async () => {
    const { docs } = await payload.find({
      collection: 'connect-dots-puzzles',
      where: othersPrivateWhere(admin.id),
      overrideAccess: false,
      user: admin,
      pagination: false,
      depth: 0,
    })
    expect(docs.map((doc) => doc.id)).toContain(ids.memberPuzzle)
  })

  it("gives a member their own and the shared boards", async () => {
    const loaded = await boardIds(ownOrSharedWhere(member.id))
    expect(loaded).toEqual(expect.arrayContaining([ids.memberPrivate, ids.memberShared]))
    expect(loaded).not.toContain(ids.adminBoard)
  })
})
