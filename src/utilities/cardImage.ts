import type { Media } from '@/payload-types'

// A board card's picture, as the board shows it (Runner) and as the offline copy keeps it
// (offlineList.ts, offlineCache.ts). The two must ask for the same picture, so they share these.

/** The `sizes` a card's picture is shown with. */
export const CARD_IMAGE_SIZES = '(max-width: 768px) 100vw, 1200px'

type CardPictureFields = {
  externalImageURL?: string | null
  image?: number | Pick<Media, 'url'> | null
}

/** A card's picture: an external symbol or an uploaded picture. */
export function cellImageSrc(cell: CardPictureFields | null | undefined): string {
  if (cell?.externalImageURL) return cell.externalImageURL
  return (cell?.image && typeof cell.image === 'object' && cell.image.url) || ''
}
