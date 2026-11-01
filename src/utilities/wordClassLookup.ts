import type { Payload } from 'payload'

import { findPictureBankFolderId, PICTURE_BANK_FOLDER_NAME } from './findLibraryMedia'
import { guessWordClass, normalizeWord, type WordClass } from './wordClass'

/**
 * The picture bank category of each word that a bank picture has as its alt text (the bank's word),
 * keyed by the normalized word. A word in two categories keeps the one imported first.
 */
export async function findPictureBankCategories(
  payload: Payload,
  words: string[],
  rootName = PICTURE_BANK_FOLDER_NAME,
): Promise<Map<string, string>> {
  const categories = new Map<string, string>()
  const variants = [...new Set(words.flatMap((word) => [word.trim(), normalizeWord(word)]))].filter(Boolean)
  if (!variants.length) return categories

  const rootId = await findPictureBankFolderId(payload, rootName)
  if (!rootId) return categories

  const { docs: folders } = await payload.find({
    collection: 'payload-folders',
    depth: 0,
    limit: 200,
    overrideAccess: true,
    pagination: false,
    where: { folder: { equals: rootId } },
  })
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]))
  if (!folderNames.size) return categories

  const { docs } = await payload.find({
    collection: 'media',
    depth: 0,
    pagination: false,
    select: { alt: true, folder: true },
    sort: 'id',
    where: { and: [{ folder: { in: [...folderNames.keys()] } }, { alt: { in: variants } }] },
  })

  for (const media of docs) {
    const folderId = typeof media.folder === 'object' && media.folder ? media.folder.id : media.folder
    const name = typeof folderId === 'number' ? folderNames.get(folderId) : undefined
    const word = typeof media.alt === 'string' ? normalizeWord(media.alt) : ''
    if (name && word && !categories.has(word)) categories.set(word, name)
  }

  return categories
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
