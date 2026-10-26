// Where uploaded media files are served from.
// - Production: R2 serves them on the public media domain.
// - Elsewhere: uploads go to the local R2 bucket (`.wrangler/state`), which the public domain doesn't
//   have, so files are served by `/next/dev-media`. That route falls back to the public domain for
//   media copied from production.

export const PUBLIC_MEDIA_BASE_URL = (
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL || 'https://media.suhtleja.ee'
).replace(/\/$/, '')

export const DEV_MEDIA_PATH = '/next/dev-media'

export function getMediaFileURL(key: string): string {
  return process.env.NODE_ENV === 'production'
    ? `${PUBLIC_MEDIA_BASE_URL}/${key}`
    : `${DEV_MEDIA_PATH}/${key}`
}

// Media files are served as they are, without Next's image optimizer. A dev URL may already have
// the site origin in front (getMediaUrl adds it).
export function isMediaFileURL(src: string): boolean {
  return (
    src === PUBLIC_MEDIA_BASE_URL ||
    src.startsWith(`${PUBLIC_MEDIA_BASE_URL}/`) ||
    src.includes(`${DEV_MEDIA_PATH}/`)
  )
}
