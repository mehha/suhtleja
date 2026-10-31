import type { Payload, PayloadRequest, Where } from 'payload'

import type { Media } from '@/payload-types'

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']

/** The library folder that saved AI pictograms are filed into (src/collections/SymbolGenerations.ts). */
export const AI_PICTURE_FOLDER_NAME = 'AI-pildid'

const exactWordMatch = (word: string): Where | null => {
  const variants = [...new Set([word.trim(), word.trim().toLowerCase()])].filter(Boolean)
  if (!variants.length) return null

  return {
    or: [
      { alt: { in: variants } },
      { filename: { in: variants.flatMap((v) => IMAGE_EXTENSIONS.map((ext) => `${v}.${ext}`)) } },
    ],
  }
}

async function findFirstMedia(payload: Payload, where: Where) {
  const { docs } = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 1,
    pagination: false,
    sort: '-createdAt',
    where,
  })

  const media = docs[0]
  return media?.id && media.url ? media : null
}

export async function findAIPictureFolderId(
  payload: Payload,
  req?: Partial<PayloadRequest>,
): Promise<number | null> {
  const { docs } = await payload.find({
    collection: 'payload-folders',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { name: { equals: AI_PICTURE_FOLDER_NAME } },
  })

  return typeof docs[0]?.id === 'number' ? docs[0].id : null
}

export async function getOrCreateAIPictureFolderId(
  payload: Payload,
  req?: Partial<PayloadRequest>,
): Promise<number> {
  const existing = await findAIPictureFolderId(payload, req)
  if (existing) return existing

  const folder = await payload.create({
    collection: 'payload-folders',
    data: { folderType: ['media'], name: AI_PICTURE_FOLDER_NAME },
    overrideAccess: true,
    req,
  })

  return folder.id
}

// Bulk add's own picture for a word: a media library file (one in a folder) whose alt text or file
// name is exactly that word. Admin-curated folders come before the AI pictures members saved. A loose
// match picked homepage screenshots for "mina" and "ema", and could pick another customer's upload.
export async function findLibraryMedia(payload: Payload, word: string): Promise<Media | null> {
  const match = exactWordMatch(word)
  if (!match) return null

  const aiFolderId = await findAIPictureFolderId(payload)
  const curated = await findFirstMedia(payload, {
    and: [
      { folder: { exists: true } },
      ...(aiFolderId ? [{ folder: { not_equals: aiFolderId } }] : []),
      match,
    ],
  })
  if (curated || !aiFolderId) return curated

  return findFirstMedia(payload, { and: [{ folder: { equals: aiFolderId } }, match] })
}

// The member's own picture for a word (an upload or a saved AI picture), exactly like findLibraryMedia.
// Bulk add prefers it to the library and the symbol banks.
export async function findOwnMedia(
  payload: Payload,
  word: string,
  userId: number,
): Promise<Media | null> {
  const match = exactWordMatch(word)
  if (!match) return null

  return findFirstMedia(payload, {
    and: [{ owner: { equals: userId } }, { mimeType: { contains: 'image' } }, match],
  })
}

export type PictureItem = {
  id: string
  mediaId: number
  title: string
  preview: string
  source: 'library' | 'mine'
}

const toPictureItem = (media: Media, source: PictureItem['source']): PictureItem | null => {
  if (!media.url) return null
  const fileTitle = media.filename?.replace(/\.[^.]+$/, '') ?? ''

  return {
    id: `media-${media.id}`,
    mediaId: media.id,
    preview: media.url,
    source,
    title: (typeof media.alt === 'string' && media.alt.trim()) || fileTitle,
  }
}

/**
 * Pictures for the card editor's search: the member's own images (`mine`) or the shared library
 * (`library`, media in a folder). Never other customers' files outside the library. Without a query
 * the newest come first, so the search doubles as browsing.
 */
export async function searchPictureMedia(
  payload: Payload,
  {
    excludeIds = [],
    limit,
    q,
    scope,
    userId,
  }: { excludeIds?: number[]; limit: number; q: string; scope: 'library' | 'mine'; userId: number },
): Promise<PictureItem[]> {
  const conditions: Where[] = [
    { mimeType: { contains: 'image' } },
    scope === 'mine' ? { owner: { equals: userId } } : { folder: { exists: true } },
  ]
  if (q) {
    conditions.push({ or: [{ alt: { contains: q } }, { filename: { contains: q } }] })
  }
  if (excludeIds.length) {
    conditions.push({ id: { not_in: excludeIds } })
  }

  // Media is publicly readable; the where clause above is what keeps other customers' files out.
  const { docs } = await payload.find({
    collection: 'media',
    depth: 0,
    limit,
    pagination: false,
    sort: '-createdAt',
    where: { and: conditions },
  })

  return docs.flatMap((media) => {
    const item = toPictureItem(media, scope)
    return item ? [item] : []
  })
}
