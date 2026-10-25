import type { Payload } from 'payload'

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']

// Bulk add's own picture for a word: a media library file (one in a folder, like the cell
// editor's Meedia tab) whose alt text or file name is exactly that word. A loose match picked
// homepage screenshots for "mina" and "ema", and could pick another customer's upload.
export async function findLibraryMedia(payload: Payload, word: string) {
  const variants = [...new Set([word.trim(), word.trim().toLowerCase()])].filter(Boolean)
  if (!variants.length) return null

  const { docs } = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 1,
    pagination: false,
    where: {
      and: [
        { folder: { exists: true } },
        {
          or: [
            { alt: { in: variants } },
            { filename: { in: variants.flatMap((v) => IMAGE_EXTENSIONS.map((ext) => `${v}.${ext}`)) } },
          ],
        },
      ],
    },
  })

  const media = docs[0]
  return media?.id && media.url ? media : null
}
