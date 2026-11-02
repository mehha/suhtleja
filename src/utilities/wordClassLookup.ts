import type { Payload } from 'payload'

import { findPictureBankFolderId, PICTURE_BANK_FOLDER_NAME } from './findLibraryMedia'
import { guessWordClass, normalizeWord, type WordClass } from './wordClass'

export type PictureBankMedia = { id: number; category: string }

const WORD_BATCH = 50

/**
 * The bank picture of each word that a bank picture has as its alt text (the bank's word), with its
 * picture bank category, keyed by the normalized word. A word in two categories keeps the picture
 * imported first.
 */
export async function findPictureBankMedia(
  payload: Payload,
  words: string[],
  rootName = PICTURE_BANK_FOLDER_NAME,
): Promise<Map<string, PictureBankMedia>> {
  const pictures = new Map<string, PictureBankMedia>()
  const variants = [...new Set(words.flatMap((word) => [word.trim(), normalizeWord(word)]))].filter(Boolean)
  if (!variants.length) return pictures

  const rootId = await findPictureBankFolderId(payload, rootName)
  if (!rootId) return pictures

  const { docs: folders } = await payload.find({
    collection: 'payload-folders',
    depth: 0,
    limit: 200,
    overrideAccess: true,
    pagination: false,
    where: { folder: { equals: rootId } },
  })
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]))
  if (!folderNames.size) return pictures

  // D1 binds at most 100 parameters in a query, and the bank has dozens of categories: the words
  // go in batches, and the folder is checked here.
  const docs: Array<{ id: number; alt?: string | null; folder?: number | { id: number } | null }> = []
  for (let start = 0; start < variants.length; start += WORD_BATCH) {
    const batch = await payload.find({
      collection: 'media',
      depth: 0,
      pagination: false,
      select: { alt: true, folder: true },
      where: { alt: { in: variants.slice(start, start + WORD_BATCH) } },
    })
    docs.push(...batch.docs)
  }
  docs.sort((a, b) => a.id - b.id)

  for (const media of docs) {
    const folderId = typeof media.folder === 'object' && media.folder ? media.folder.id : media.folder
    const category = typeof folderId === 'number' ? folderNames.get(folderId) : undefined
    const word = typeof media.alt === 'string' ? normalizeWord(media.alt) : ''
    if (category && word && !pictures.has(word)) pictures.set(word, { id: media.id, category })
  }

  return pictures
}

/**
 * The picture bank category of each word that a bank picture has as its alt text, keyed by the
 * normalized word (see findPictureBankMedia).
 */
export async function findPictureBankCategories(
  payload: Payload,
  words: string[],
  rootName = PICTURE_BANK_FOLDER_NAME,
): Promise<Map<string, string>> {
  const pictures = await findPictureBankMedia(payload, words, rootName)
  return new Map([...pictures].map(([word, { category }]) => [word, category]))
}

/** The suggested class of each word (see guessWordClass), keyed by the words as given. */
export async function findWordClasses(
  payload: Payload,
  words: string[],
  rootName = PICTURE_BANK_FOLDER_NAME,
): Promise<Record<string, WordClass | null>> {
  const categories = await findPictureBankCategories(payload, words, rootName)
  return Object.fromEntries(
    words.map((word) => [word, guessWordClass(word, categories.get(normalizeWord(word)))]),
  )
}
