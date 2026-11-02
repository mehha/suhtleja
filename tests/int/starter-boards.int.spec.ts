// @vitest-environment node

// The starter set (src/utilities/starterBoards.ts): five boards made as the member's own, the core
// words board opening the four topic boards. Pictures come from a picture bank root of the test's
// own, so the test never depends on an imported "Pildipank"; speech isn't made (no Azure calls).

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Board, User } from '@/payload-types'
import { applyGrammar } from '@/utilities/grammar/applyGrammar'
import { STARTER_BOARDS, createStarterBoardsForUser, starterWordClass } from '@/utilities/starterBoards'

const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const root = `Pildipank-starter-${run}`

// 1x1 transparent PNG.
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

let payload: Payload
type TestUser = User & { collection: 'users' }
let member: TestUser
let freeUser: TestUser
const created: Array<{ collection: 'users' | 'boards' | 'media' | 'payload-folders'; id: number }> = []

async function createUser(name: string, membershipStatus: 'active' | 'none'): Promise<TestUser> {
  const doc = await payload.create({
    collection: 'users',
    data: { email: `starter-${name}-${run}@suhtleja.test`, password: `test-${run}-Passw0rd`, name, role: 'user', membershipStatus } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'users', id: doc.id })
  return { ...doc, collection: 'users' }
}

const ownerId = (owner: unknown) => (typeof owner === 'object' && owner ? (owner as { id: number }).id : owner)

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  member = await createUser('member', 'active')
  freeUser = await createUser('free', 'none')

  // A bank of one picture: "pall" in Mänguasjad.
  const rootFolder = await payload.create({ collection: 'payload-folders', data: { name: root } as never, overrideAccess: true })
  created.push({ collection: 'payload-folders', id: rootFolder.id })
  const toys = await payload.create({
    collection: 'payload-folders',
    data: { name: 'Mänguasjad', folder: rootFolder.id } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'payload-folders', id: toys.id })
  const ball = await payload.create({
    collection: 'media',
    data: { alt: 'pall', folder: toys.id } as never,
    file: { data: tinyPng, mimetype: 'image/png', name: `starter-pall-${run}.png`, size: tinyPng.length },
    overrideAccess: true,
  })
  created.push({ collection: 'media', id: ball.id })
  // A real bank has dozens of categories (D1 binds at most 100 parameters in a query).
  for (let index = 0; index < 40; index++) {
    const folder = await payload.create({
      collection: 'payload-folders',
      data: { name: `Kategooria ${index}`, folder: rootFolder.id } as never,
      overrideAccess: true,
    })
    created.push({ collection: 'payload-folders', id: folder.id })
  }
})

afterAll(async () => {
  for (const { collection, id } of created.reverse()) {
    await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
  }
})

describe("the starter set's words", () => {
  const say = (...words: string[]) =>
    applyGrammar(words.map((text) => ({ text, wordClass: starterWordClass(text) }))).join(' ')

  it('take their forms in the sentences they are for', () => {
    expect(say('mina', 'tahtma', 'õun')).toBe('mina tahan õuna')
    expect(say('mina', 'minema', 'park')).toBe('mina lähen parki')
    expect(say('mina', 'mängima', 'pall')).toBe('mina mängin palliga')
    expect(say('mina', 'olema', 'rõõmus')).toBe('mina olen rõõmus')
    expect(say('mina', 'minema', 'kiik')).toBe('mina lähen kiigele')
    expect(say('mina', 'mängima', 'liivakast')).toBe('mina mängin liivakastis')
    expect(say('mina', 'mängima', 'koos', 'sõber')).toBe('mina mängin koos sõbraga')
    expect(say('mina', 'minema', 'eile', 'pood')).toBe('mina läksin eile poodi')
    expect(say('mina', 'minema', 'vanaema', 'juurde')).toBe('mina lähen vanaema juurde')
  })
})

describe('the starter set', () => {
  let boards: Board[]
  let coreId: number

  beforeAll(async () => {
    const result = await createStarterBoardsForUser(payload, member, { speech: false, rootName: root })
    coreId = result.coreId
    boards = await Promise.all(
      result.ids.map((id) => payload.findByID({ collection: 'boards', id, depth: 0, overrideAccess: true })),
    )
    for (const board of boards) created.push({ collection: 'boards', id: board.id })
  })

  it("makes five boards as the member's own, the core words on the home", () => {
    expect(boards.map((board) => board.name)).toEqual(STARTER_BOARDS.map((board) => board.name))
    expect(boards.every((board) => ownerId(board.owner) === member.id && !board.visibleToAllUsers)).toBe(true)
    expect(boards.filter((board) => board.pinned).map((board) => board.id)).toEqual([coreId])
    expect(boards.every((board) => board.extra?.grammar === true && board.grid?.cols === 6)).toBe(true)
    // Made first, so the lists show the core words before their topics.
    expect(boards[0]?.id).toBe(coreId)
    const orders = boards.map((board) => board.order ?? 0)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('lays the words out in reading order, with their word classes', () => {
    const food = boards.find((board) => board.name === 'Söök ja jook')!
    const cells = food.grid?.cells ?? []
    expect(cells.slice(0, 3).map(({ title, x, y }) => ({ title, x, y }))).toEqual([
      { title: 'sööma', x: 0, y: 0 },
      { title: 'jooma', x: 1, y: 0 },
      { title: 'tahtma', x: 2, y: 0 },
    ])
    expect(cells[6]).toMatchObject({ title: 'vesi', x: 0, y: 1 })
    expect(cells.find((cell) => cell.title === 'sööma')?.wordClass).toBe('verb')
    // Every word has a class, the bank or not: "vesi" isn't in this test's bank.
    expect(cells.find((cell) => cell.title === 'vesi')?.wordClass).toBe('noun')
    const words = boards.flatMap((board) => (board.grid?.cells ?? []).filter((cell) => !cell.linkBoard))
    expect(words.filter((cell) => !cell.wordClass).map((cell) => cell.title)).toEqual([])
  })

  it('opens the four topic boards from the core words', () => {
    const core = boards.find((board) => board.id === coreId)!
    const links = (core.grid?.cells ?? []).filter((cell) => typeof cell.linkBoard === 'number')
    const byId = new Map(boards.map((board) => [board.id, board.name]))
    expect(links.map((cell) => [cell.title, byId.get(cell.linkBoard!)])).toEqual([
      ['Söök', 'Söök ja jook'],
      ['Mängimine', 'Mängimine'],
      ['Tunded', 'Tunded'],
      ['Kohad', 'Kohad'],
    ])
  })

  it("gives a card the bank's picture and class when the bank has the word", () => {
    const play = boards.find((board) => board.name === 'Mängimine')!
    const ball = play.grid?.cells?.find((cell) => cell.title === 'pall')
    expect(ball?.image).toBeTruthy()
    expect(ball?.wordClass).toBe('noun')
    // A word the bank lacks has no picture.
    expect(play.grid?.cells?.find((cell) => cell.title === 'auto')?.image).toBeFalsy()
  })

  it('makes nothing for a user without a membership', async () => {
    await expect(createStarterBoardsForUser(payload, freeUser, { speech: false, rootName: root })).rejects.toThrow()
  })
})
