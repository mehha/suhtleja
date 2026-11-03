// @vitest-environment node

// What a device keeps for the child without the network (GET /next/offline, src/utilities/offlineList.ts):
// the home, its boards and the boards their cards open that the member can read, the games on it,
// and their saved speech in the member's voice. Every run creates its own users, boards and game and
// deletes them afterwards.

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import type { Board, Media, User } from '@/payload-types'
import { buildOfflineList, type OfflineList } from '@/utilities/offlineList'

// No speech service here: a save keeps its words in the speech manifest without their audio.
vi.mock('@/utilities/azureTTS', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utilities/azureTTS')>()),
  synthesizeAzureSpeech: vi.fn(async () => {
    throw new Error('no speech service in this test')
  }),
}))

const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const password = `test-${run}-Passw0rd`

let payload: Payload
let alice: User
let bob: User
let home: Board
let linked: Board
let notOnHome: Board
let bobPrivate: Board
let sharedHidden: Board
let puzzleId: number
let picture: Media

const created: Array<{ collection: 'users' | 'boards' | 'connect-dots-puzzles' | 'media'; id: number }> = []

async function createUser(name: string, data: Partial<User> = {}): Promise<User> {
  const doc = await payload.create({
    collection: 'users',
    data: { email: `offline-${name}-${run}@suhtleja.test`, password, name, role: 'user', membershipStatus: 'active', ...data } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'users', id: doc.id })
  return doc
}

async function createBoard(name: string, data: Partial<Board>): Promise<Board> {
  const doc = await payload.create({
    collection: 'boards',
    data: { name: `${name} ${run}`, pinned: false, ...data } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'boards', id: doc.id })
  return doc
}

const cell = (id: string, x: number, extra: Record<string, unknown> = {}) => ({ id: `${id}-${run}`, x, y: 0, w: 1, h: 1, ...extra })
const speech = (hash: string, text: string) => ({
  entries: [{ hash, key: `tts/ms/x/${hash}.mp3`, text, source: 'cell' }],
  updatedAt: '',
})

const urls = (list: OfflineList) => list.pages.map((page) => page.url)
const version = (list: OfflineList, url: string) => list.pages.find((page) => page.url === url)?.version

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  bob = await createUser('bob')
  bobPrivate = await createBoard('Bobi oma', { owner: bob.id })
  sharedHidden = await createBoard('Peidetud', { owner: bob.id, visibleToAllUsers: true })
  // Alice speaks slowly (profile page), and has hidden Bob's shared board from her home.
  alice = await createUser('alice', { speechRate: 'slow', hiddenSharedBoardIds: [String(sharedHidden.id)] } as Partial<User>)

  // An uploaded picture for a card (1x1 PNG).
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
  picture = await payload.create({
    collection: 'media',
    data: { alt: `kass ${run}`, owner: alice.id } as never,
    file: { data: png, mimetype: 'image/png', name: `offline-kass-${run}.png`, size: png.length },
    overrideAccess: true,
  })
  created.push({ collection: 'media', id: picture.id })

  linked = await createBoard('Söök', { owner: alice.id })
  notOnHome = await createBoard('Mujal', {
    owner: alice.id,
    grid: { cols: 1, rows: 1, cells: [cell('mujal', 0, { title: 'mujal', externalImageURL: '/mujal.png' })] },
  } as Partial<Board>)
  home = await createBoard('Kodu tahvel', {
    owner: alice.id,
    pinned: true,
    ttsCache: speech('homehash', 'mina.'),
    grid: {
      cols: 3,
      rows: 1,
      cells: [
        cell('mina', 0, { title: 'mina', externalImageURL: '/og-image.jpg' }),
        cell('sook', 1, { title: 'söök', linkBoard: linked.id, image: picture.id }),
        // Bob's private board: an ordinary card for Alice, nothing to keep.
        cell('bob', 2, { title: 'bob', linkBoard: bobPrivate.id }),
      ],
    },
  } as Partial<Board>)
  // The linked board opens the home board again: a circle is kept once. The save makes its speech
  // manifest.
  linked = await payload.update({
    collection: 'boards',
    id: linked.id,
    data: { grid: { cols: 1, rows: 1, cells: [cell('tagasi', 0, { title: 'tagasi', linkBoard: home.id })] } } as never,
    overrideAccess: true,
  })

  const puzzle = await payload.create({
    collection: 'connect-dots-puzzles',
    data: {
      title: `Punktid ${run}`,
      slug: `offline-puzzle-${run}`,
      owner: alice.id,
      enabled: true,
      pinned: true,
      externalImageURL: '/og-image.jpg',
      dots: [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.9 },
      ],
    } as never,
    overrideAccess: true,
  })
  puzzleId = puzzle.id
  created.push({ collection: 'connect-dots-puzzles', id: puzzle.id })
})

afterAll(async () => {
  for (const { collection, id } of created.reverse()) {
    await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
  }
})

describe('the offline list', () => {
  it('keeps the home, its boards, the boards their cards open and the games', async () => {
    const list = await buildOfflineList(payload, alice)
    expect(list.userId).toBe(alice.id)
    expect(urls(list)).toEqual(
      expect.arrayContaining([
        '/kodu',
        `/boards/${home.id}`,
        `/boards/${linked.id}`,
        // A card opens its board with a back button.
        `/boards/${linked.id}?from=${home.id}`,
        `/boards/${home.id}?from=${linked.id}`,
        `/connect-dots?puzzle=${puzzleId}`,
      ]),
    )
    expect(urls(list).filter((url) => url === `/boards/${home.id}`)).toHaveLength(1)
  })

  it('leaves out what the home does not reach, what the member hid and what they cannot read', async () => {
    const list = await buildOfflineList(payload, alice)
    for (const board of [notOnHome, bobPrivate, sharedHidden]) {
      expect(urls(list).some((url) => url.startsWith(`/boards/${board.id}`))).toBe(false)
    }
  })

  it("keeps the saved speech in the member's voice and rate, and the game's sounds", async () => {
    const list = await buildOfflineList(payload, alice)
    const homeSpeech = list.media.find((url) => url.startsWith(`/next/tts-cache/${home.id}/homehash`))
    expect(homeSpeech).toMatch(/\?voice=.+&rate=slow$/)
    expect(list.media.some((url) => url.startsWith(`/next/tts-cache/${linked.id}/`))).toBe(true)
    expect(list.media).toEqual(expect.arrayContaining(['/connect-dots-success.mp3', '/soft-dots-journey.mp3']))
  })

  // A board's cards render in the browser only, so the device can't find their pictures in the page.
  it("keeps the kept boards' card pictures as the board shows them, an upload and a symbol", async () => {
    const list = await buildOfflineList(payload, alice)
    expect(picture.url).toBeTruthy()
    expect(list.pictures).toEqual(expect.arrayContaining(['/og-image.jpg', picture.url]))
    expect(list.pictures).not.toContain('/mujal.png')
  })

  it('changes the version of exactly the pages a change shows on', async () => {
    const before = await buildOfflineList(payload, alice)
    await new Promise((resolve) => setTimeout(resolve, 5))
    await payload.update({ collection: 'boards', id: linked.id, data: { name: `Söök uus ${run}` }, overrideAccess: true })
    const after = await buildOfflineList(payload, alice)

    // The linked board itself, and the home board, whose card shows its name.
    expect(version(after, `/boards/${linked.id}`)).not.toBe(version(before, `/boards/${linked.id}`))
    expect(version(after, `/boards/${home.id}`)).not.toBe(version(before, `/boards/${home.id}`))
    // The home lists only its own boards.
    expect(version(after, '/kodu')).toBe(version(before, '/kodu'))
  })

  it('keeps nothing of a board another member shares until it is on the home', async () => {
    const list = await buildOfflineList(payload, bob)
    expect(list.userId).toBe(bob.id)
    expect(urls(list).some((url) => url.startsWith(`/boards/${home.id}`))).toBe(false)
  })
})
