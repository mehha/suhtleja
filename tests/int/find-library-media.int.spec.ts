// @vitest-environment node

// Bulk add's own pictures (src/utilities/findLibraryMedia.ts): only media library files whose alt
// text or file name is exactly the word. Every run creates its own media and deletes it afterwards.

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { findLibraryMedia } from '@/utilities/findLibraryMedia'

const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const word = (name: string) => `${name}${run}`

// 1x1 transparent PNG.
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

let payload: Payload
let folderId: number
const createdMedia: number[] = []

async function createMedia(name: string, data: { alt?: string; inLibrary: boolean }) {
  const doc = await payload.create({
    collection: 'media',
    data: { alt: data.alt, folder: data.inLibrary ? folderId : undefined } as never,
    file: { data: tinyPng, mimetype: 'image/png', name, size: tinyPng.length },
    overrideAccess: true,
  })
  createdMedia.push(doc.id)
  return doc
}

beforeAll(async () => {
  payload = await getPayload({ config })
  const folder = await payload.create({ collection: 'payload-folders', data: { name: `Test ${run}` } as never, overrideAccess: true })
  folderId = folder.id as number
}, 120000)

afterAll(async () => {
  for (const id of createdMedia) await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => {})
  if (folderId) await payload.delete({ collection: 'payload-folders', id: folderId, overrideAccess: true }).catch(() => {})
})

describe('findLibraryMedia', () => {
  it('finds a library file named after the word', async () => {
    const file = await createMedia(`${word('kurb')}.png`, { inLibrary: true })
    expect((await findLibraryMedia(payload, word('kurb')))?.id).toBe(file.id)
  })

  it('finds a library file by exact alt text, ignoring the case of the word', async () => {
    const file = await createMedia(`pilt-${run}.png`, { alt: word('õun'), inLibrary: true })
    expect((await findLibraryMedia(payload, word('Õun')))?.id).toBe(file.id)
  })

  it('ignores files outside the library, such as homepage screenshots and customer uploads', async () => {
    await createMedia(`samm-${run}.png`, { alt: `Lapse tahvel, mille allribal on lause „${word('mina')} tahan süüa“`, inLibrary: false })
    await createMedia(`${word('mina')}.png`, { inLibrary: false })
    expect(await findLibraryMedia(payload, word('mina'))).toBeNull()
  })

  it('does not match the word inside a longer name', async () => {
    await createMedia(`va${word('ema')}.png`, { alt: `Va${word('ema')} vaade`, inLibrary: true })
    expect(await findLibraryMedia(payload, word('ema'))).toBeNull()
  })
})
