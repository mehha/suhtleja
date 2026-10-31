// @vitest-environment node

// The card editor's pictures: own pictures and the shared library (src/utilities/findLibraryMedia.ts),
// bulk add's preference for the member's own picture, and saved AI pictures joining the library
// (src/utilities/symbolGeneration.ts, src/collections/SymbolGenerations.ts). Every run creates its own
// users, media and folders and deletes them afterwards.

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'
import {
  findAIPictureFolderId,
  findLibraryMedia,
  findOwnMedia,
  getOrCreateAIPictureFolderId,
  searchPictureMedia,
} from '@/utilities/findLibraryMedia'
import { saveGeneratedPicture, sha256Hex } from '@/utilities/symbolGeneration'

const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const word = (name: string) => `${name}${run}`

// 1x1 PNGs: transparent and black.
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)
const otherPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const dataURL = (bytes: Buffer) => `data:image/png;base64,${bytes.toString('base64')}`

let payload: Payload
let alice: User
let bob: User
let curatedFolderId: number
let aiFolderId: number
let aiFolderCreatedHere = false
const created: Array<{ collection: 'media' | 'payload-folders' | 'symbol-generations' | 'users'; id: number }> = []

async function createUser(name: string) {
  const user = await payload.create({
    collection: 'users',
    data: { email: `ai-pictures-${name}-${run}@suhtleja.test`, password: `x-${run}-Pw0rd`, name, role: 'user', membershipStatus: 'active' } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'users', id: user.id })
  return user
}

async function createMedia(name: string, data: { alt?: string; folder?: number; owner?: number; bytes?: Buffer }) {
  const bytes = data.bytes ?? tinyPng
  const doc = await payload.create({
    collection: 'media',
    data: { alt: data.alt, folder: data.folder, owner: data.owner } as never,
    file: { data: bytes, mimetype: 'image/png', name, size: bytes.length },
    overrideAccess: true,
  })
  created.push({ collection: 'media', id: doc.id })
  return doc
}

async function createGeneration(user: User, label: string, personal: boolean) {
  const doc = await payload.create({
    collection: 'symbol-generations',
    data: { imageHashes: [sha256Hex(tinyPng)], images: 1, label, personal, user: user.id },
    overrideAccess: true,
  })
  created.push({ collection: 'symbol-generations', id: doc.id })
  return doc
}

const folderOf = async (mediaId: number) => {
  const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true })
  return typeof media.folder === 'object' && media.folder ? media.folder.id : (media.folder ?? null)
}

beforeAll(async () => {
  payload = await getPayload({ config })
  alice = await createUser('alice')
  bob = await createUser('bob')
  const folder = await payload.create({ collection: 'payload-folders', data: { name: `Curated ${run}` } as never, overrideAccess: true })
  curatedFolderId = folder.id
  created.push({ collection: 'payload-folders', id: folder.id })
  aiFolderCreatedHere = !(await findAIPictureFolderId(payload))
  aiFolderId = await getOrCreateAIPictureFolderId(payload)
}, 120000)

afterAll(async () => {
  // Generations first: their delete hook touches the media.
  const order = ['symbol-generations', 'media', 'payload-folders', 'users'] as const
  for (const collection of order) {
    for (const { id } of created.filter((entry) => entry.collection === collection)) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => {})
    }
  }
  if (aiFolderCreatedHere) await payload.delete({ collection: 'payload-folders', id: aiFolderId, overrideAccess: true }).catch(() => {})
}, 120000)

describe('picture search', () => {
  it("finds the member's own pictures and the library, never another customer's own pictures", async () => {
    const own = await createMedia(`${word('kass')}-a.png`, { alt: word('kass'), owner: alice.id })
    const library = await createMedia(`${word('kass')}-lib.png`, { alt: `${word('kass')} must`, folder: curatedFolderId })
    const bobs = await createMedia(`${word('kass')}-b.png`, { alt: word('kass'), owner: bob.id })

    const mine = await searchPictureMedia(payload, { limit: 20, q: word('kass'), scope: 'mine', userId: alice.id })
    expect(mine.map((item) => item.mediaId)).toEqual([own.id])

    const shared = await searchPictureMedia(payload, { limit: 20, q: word('kass'), scope: 'library', userId: alice.id })
    expect(shared.map((item) => item.mediaId)).toEqual([library.id])
    expect(shared.map((item) => item.mediaId)).not.toContain(bobs.id)
  })
})

describe('bulk add pictures', () => {
  it("prefers the member's own picture, then curated folders, then AI pictures", async () => {
    const aiPicture = await createMedia(`${word('pall')}-ai.png`, { alt: word('pall'), folder: aiFolderId, owner: bob.id })
    expect((await findLibraryMedia(payload, word('pall')))?.id).toBe(aiPicture.id)

    const curated = await createMedia(`${word('pall')}-cur.png`, { alt: word('pall'), folder: curatedFolderId })
    expect((await findLibraryMedia(payload, word('pall')))?.id).toBe(curated.id)

    expect(await findOwnMedia(payload, word('pall'), alice.id)).toBeNull()
    const own = await createMedia(`${word('pall')}-own.png`, { alt: word('pall'), owner: alice.id })
    expect((await findOwnMedia(payload, word('pall'), alice.id))?.id).toBe(own.id)
  })
})

describe('saving AI pictures', () => {
  it('saves only an image generated for this member, once', async () => {
    const generation = await createGeneration(alice, word('koer'), false)

    expect(await saveGeneratedPicture(payload, { dataURL: dataURL(tinyPng), generationId: generation.id, userId: bob.id }))
      .toMatchObject({ ok: false, error: 'not_found' })
    expect(await saveGeneratedPicture(payload, { dataURL: dataURL(otherPng), generationId: generation.id, userId: alice.id }))
      .toMatchObject({ ok: false, error: 'unknown_image' })
    expect(await saveGeneratedPicture(payload, { dataURL: 'data:text/html;base64,PGI+', generationId: generation.id, userId: alice.id }))
      .toMatchObject({ ok: false, error: 'invalid_image' })

    const saved = await saveGeneratedPicture(payload, { dataURL: dataURL(tinyPng), generationId: generation.id, userId: alice.id })
    if (!saved.ok) throw new Error(saved.error)
    created.push({ collection: 'media', id: saved.media.id })

    expect(saved.shared).toBe(true)
    const media = await payload.findByID({ collection: 'media', id: saved.media.id, depth: 0, overrideAccess: true })
    expect(media.alt).toBe(word('koer'))
    expect(typeof media.owner === 'object' && media.owner ? media.owner.id : media.owner).toBe(alice.id)
    expect(await folderOf(saved.media.id)).toBe(aiFolderId)

    expect(await saveGeneratedPicture(payload, { dataURL: dataURL(tinyPng), generationId: generation.id, userId: alice.id }))
      .toMatchObject({ ok: false, error: 'already_saved' })
  })

  it('keeps a personal label private', async () => {
    const generation = await createGeneration(alice, `vanaema ${word('Malle')}`, true)
    const saved = await saveGeneratedPicture(payload, { dataURL: dataURL(tinyPng), generationId: generation.id, userId: alice.id })
    if (!saved.ok) throw new Error(saved.error)
    created.push({ collection: 'media', id: saved.media.id })

    expect(saved.shared).toBe(false)
    expect(await folderOf(saved.media.id)).toBeNull()
  })

  it('lets an admin take a picture out of the library, keeping the media', async () => {
    const generation = await createGeneration(alice, word('hobune'), false)
    const saved = await saveGeneratedPicture(payload, { dataURL: dataURL(tinyPng), generationId: generation.id, userId: alice.id })
    if (!saved.ok) throw new Error(saved.error)
    created.push({ collection: 'media', id: saved.media.id })
    expect(await folderOf(saved.media.id)).toBe(aiFolderId)

    await payload.update({ collection: 'symbol-generations', id: generation.id, data: { shared: false }, overrideAccess: true })
    expect(await folderOf(saved.media.id)).toBeNull()

    await payload.update({ collection: 'symbol-generations', id: generation.id, data: { shared: true }, overrideAccess: true })
    expect(await folderOf(saved.media.id)).toBe(aiFolderId)

    await payload.delete({ collection: 'symbol-generations', id: generation.id, overrideAccess: true })
    expect(await folderOf(saved.media.id)).toBeNull()
  })
})
