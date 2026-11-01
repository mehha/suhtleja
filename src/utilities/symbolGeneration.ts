import { createHash } from 'crypto'
import type { Payload } from 'payload'

import { slugify } from './slugify'

/** "Loo pilt" requests a member may make per calendar month (UTC). Each request makes several images. */
export const SYMBOL_GENERATIONS_PER_MONTH = 30
export const SYMBOL_GENERATION_VARIANTS = 4
export const SYMBOL_GENERATION_SIZE = 768
export const SYMBOL_GENERATION_MODEL = '@cf/black-forest-labs/flux-2-klein-4b'
export const SYMBOL_GENERATION_LABEL_MAX_LENGTH = 80

export function startOfMonthUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export async function countSymbolGenerationsThisMonth(
  payload: Payload,
  userId: number | string,
  now = new Date(),
): Promise<number> {
  const { totalDocs } = await payload.count({
    collection: 'symbol-generations',
    where: {
      and: [
        { user: { equals: userId } },
        { createdAt: { greater_than_equal: startOfMonthUTC(now).toISOString() } },
      ],
    },
  })

  return totalDocs
}

/** The image prompt: one consistent pictogram style around the scene Groq described. */
export function buildPictogramPrompt(subject: string, { group = false }: { group?: boolean } = {}): string {
  return [
    `Pictogram for an AAC communication board: ${subject.trim()}.`,
    'Simple flat illustration with thick black outlines and bright flat colours,',
    'plain white background, one centred subject filling most of the frame,',
    // The picture bank's group words (meie, nemad, perekond) need more than two people.
    group
      ? 'minimal detail and only the figures described, friendly and clear for young children.'
      : 'minimal detail and at most two figures, friendly and clear for young children.',
    'No text, no letters, no numbers, no frame, no shadows.',
  ].join(' ')
}

/** Workers AI returns the image as bare base64; tell the browser what it is. */
export function base64ImageToDataURL(base64: string): string {
  const mimeType = base64.startsWith('iVBOR')
    ? 'image/png'
    : base64.startsWith('UklGR')
      ? 'image/webp'
      : 'image/jpeg'

  return `data:${mimeType};base64,${base64}`
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

const SAVABLE_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_SAVED_IMAGE_BYTES = 3 * 1024 * 1024

export function parseImageDataURL(dataURL: string): { bytes: Buffer; mimeType: string } | null {
  const match = /^data:([a-z/]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataURL)
  if (!match?.[1] || !match[2] || !SAVABLE_IMAGE_TYPES[match[1]]) return null

  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.length > MAX_SAVED_IMAGE_BYTES) return null

  return { bytes, mimeType: match[1] }
}

type SaveResult =
  | { ok: true; media: { id: number; url: string | null }; shared: boolean }
  | { ok: false; error: 'already_saved' | 'invalid_image' | 'not_found' | 'unknown_image'; status: number }

/**
 * Stores one of a generation's images as the member's media and links it to the generation. Only an
 * image the server generated for this member can be stored (its hash is on the generation), because a
 * saved picture joins the shared library: the generation's hook files it into "AI-pildid" unless the
 * label was personal.
 */
export async function saveGeneratedPicture(
  payload: Payload,
  { dataURL, generationId, userId }: { dataURL: string; generationId: number; userId: number },
): Promise<SaveResult> {
  const generation = await payload
    .findByID({ collection: 'symbol-generations', id: generationId, depth: 0, overrideAccess: true })
    .catch(() => null)
  const ownerId =
    typeof generation?.user === 'object' && generation.user ? generation.user.id : generation?.user
  if (!generation || ownerId !== userId) {
    return { ok: false, error: 'not_found', status: 404 }
  }
  if (generation.media) {
    return { ok: false, error: 'already_saved', status: 409 }
  }

  const image = parseImageDataURL(dataURL)
  if (!image) {
    return { ok: false, error: 'invalid_image', status: 400 }
  }

  const hashes = Array.isArray(generation.imageHashes) ? generation.imageHashes : []
  if (!hashes.includes(sha256Hex(image.bytes))) {
    return { ok: false, error: 'unknown_image', status: 400 }
  }

  const name = `ai-${slugify(generation.label) || 'pilt'}-${generation.id}.${SAVABLE_IMAGE_TYPES[image.mimeType]}`
  const media = await payload.create({
    collection: 'media',
    data: { alt: generation.label, owner: userId },
    file: { data: image.bytes, mimetype: image.mimeType, name, size: image.bytes.length },
    overrideAccess: true,
  })

  const shared = !generation.personal
  await payload.update({
    collection: 'symbol-generations',
    id: generation.id,
    data: { media: media.id, shared },
    overrideAccess: true,
  })

  return { ok: true, media: { id: media.id, url: media.url ?? null }, shared }
}
