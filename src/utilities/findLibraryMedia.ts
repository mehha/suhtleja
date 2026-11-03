import type { Payload, PayloadRequest, Where } from 'payload'

import type { Media } from '@/payload-types'

import { rankPictureMatches } from './pictureMatch'

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']

/** The library folder that saved AI pictograms are filed into (src/collections/SymbolGenerations.ts). */
export const AI_PICTURE_FOLDER_NAME = 'AI-pildid'

/** The top library folder whose subfolders are the picture bank's categories (scripts/pildipank). */
export const PICTURE_BANK_FOLDER_NAME = 'Pildipank'

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

/** How many names containing the query a search ranks (pictureMatch.ts) before it keeps `limit`. */
const SEARCH_CANDIDATES = 200

/**
 * Pictures for the card editor's search: the member's own images (`mine`) or the shared library
 * (`library`, media in a folder). Never other customers' files outside the library. Without a query
 * the newest come first, so the search doubles as browsing. With one, the exact name comes first,
 * then names where the query starts a word, then compound tails (`rankPictureMatches`); a match
 * inside a word isn't shown. The exact name is looked up on its own, so names that merely contain
 * the query can't push it out.
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
  if (excludeIds.length) {
    conditions.push({ id: { not_in: excludeIds } })
  }

  // Media is publicly readable; the where clauses here are what keep other customers' files out.
  const find = (match: Where | null, max: number) =>
    payload
      .find({
        collection: 'media',
        depth: 0,
        limit: max,
        pagination: false,
        sort: '-createdAt',
        where: { and: match ? [...conditions, match] : conditions },
      })
      .then((result) => result.docs)

  const query = q.trim()
  if (!query) {
    return find(null, limit).then((docs) => docs.flatMap((media) => toPictureItem(media, scope) ?? []))
  }

  const exact = exactWordMatch(query)
  const [exactDocs, containing] = await Promise.all([
    exact ? find(exact, limit) : [],
    find({ or: [{ alt: { contains: query } }, { filename: { contains: query } }] }, SEARCH_CANDIDATES),
  ])
  const seen = new Set<number>()
  const docs = [...exactDocs, ...containing].filter((media) => {
    if (seen.has(media.id)) return false
    seen.add(media.id)
    return true
  })
  const names = (media: Media) => [media.alt ?? '', media.filename?.replace(/\.[^.]+$/, '') ?? ''].filter(Boolean)

  return rankPictureMatches(docs, query, names)
    .slice(0, limit)
    .flatMap((media) => toPictureItem(media, scope) ?? [])
}

export type PictureBankCategory = {
  count: number
  cover: string | null
  id: number
  name: string
}

/** The top-level folder named `rootName` (the picture bank), or null. */
export async function findPictureBankFolderId(
  payload: Payload,
  rootName = PICTURE_BANK_FOLDER_NAME,
): Promise<number | null> {
  const { docs } = await payload.find({
    collection: 'payload-folders',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: { and: [{ name: { equals: rootName } }, { folder: { exists: false } }] },
  })

  return typeof docs[0]?.id === 'number' ? docs[0].id : null
}

const folderImages = (folderId: number): Where => ({
  and: [{ folder: { equals: folderId } }, { mimeType: { contains: 'image' } }],
})

/**
 * The picture bank's categories for the card editor: the subfolders of the bank folder that hold
 * pictures, in the order they were created, each with its oldest picture as the cover.
 */
export async function listPictureBankCategories(
  payload: Payload,
  rootName = PICTURE_BANK_FOLDER_NAME,
): Promise<PictureBankCategory[]> {
  const rootId = await findPictureBankFolderId(payload, rootName)
  if (!rootId) return []

  const { docs: folders } = await payload.find({
    collection: 'payload-folders',
    depth: 0,
    limit: 200,
    overrideAccess: true,
    pagination: false,
    sort: 'id',
    where: { folder: { equals: rootId } },
  })

  const categories = await Promise.all(
    folders.map(async (folder) => {
      const { docs, totalDocs } = await payload.find({
        collection: 'media',
        depth: 0,
        limit: 1,
        sort: 'id',
        where: folderImages(folder.id),
      })
      return { count: totalDocs, cover: docs[0]?.url ?? null, id: folder.id, name: folder.name }
    }),
  )

  return categories.filter((category) => category.count > 0)
}

/**
 * The pictures in one picture bank category, oldest first (the import's order). Null when the folder
 * is not a category of the bank.
 */
export async function listPictureBankPictures(
  payload: Payload,
  folderId: number,
  { limit = 400, rootName = PICTURE_BANK_FOLDER_NAME }: { limit?: number; rootName?: string } = {},
): Promise<{ name: string; pictures: PictureItem[] } | null> {
  const [rootId, folder] = await Promise.all([
    findPictureBankFolderId(payload, rootName),
    payload
      .findByID({ collection: 'payload-folders', depth: 0, id: folderId, overrideAccess: true })
      .catch(() => null),
  ])
  const parentId = typeof folder?.folder === 'object' && folder.folder ? folder.folder.id : folder?.folder
  if (!rootId || !folder || parentId !== rootId) return null

  const { docs } = await payload.find({
    collection: 'media',
    depth: 0,
    limit,
    pagination: false,
    sort: 'id',
    where: folderImages(folderId),
  })

  return {
    name: folder.name,
    pictures: docs.flatMap((media) => {
      const item = toPictureItem(media, 'library')
      return item ? [item] : []
    }),
  }
}
