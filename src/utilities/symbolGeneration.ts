import type { Payload } from 'payload'

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
export function buildPictogramPrompt(subject: string): string {
  return [
    `Pictogram for an AAC communication board: ${subject.trim()}.`,
    'Simple flat illustration with thick black outlines and bright flat colours,',
    'plain white background, one centred subject filling most of the frame,',
    'minimal detail and at most two figures, friendly and clear for young children.',
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
