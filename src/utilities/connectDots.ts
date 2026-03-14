import { getSymbolProxyURL } from '@/utilities/symbolProxy'

export type ConnectDotsCountMode =
  | 'count-1'
  | 'count-2'
  | 'count-3'
  | 'count-4'
  | 'count-5'
  | 'alphabet'

export type ConnectDotsInteractionMode = 'click' | 'trace'

export type ConnectDotsPoint = {
  x: number
  y: number
}

const DEFAULT_CONNECT_DOTS_BACKGROUND_MUSIC_URL = '/soft-dots-journey.mp3'

export type ConnectDotsContainedRect = {
  height: number
  left: number
  top: number
  width: number
}

export type ConnectDotsPuzzle = {
  backgroundMusicUrl?: string | null
  id: string
  title: string
  description?: string | null
  imageAlt?: string | null
  imageHeight?: number | null
  imageUrl: string
  imageWidth?: number | null
  dots: ConnectDotsPoint[]
}

type MaybeRecord = Record<string, unknown> | null | undefined

export const CONNECT_DOTS_COUNT_MODE_OPTIONS: Array<{
  label: string
  value: ConnectDotsCountMode
}> = [
  { label: '1 kaupa', value: 'count-1' },
  { label: '2 kaupa', value: 'count-2' },
  { label: '3 kaupa', value: 'count-3' },
  { label: '4 kaupa', value: 'count-4' },
  { label: '5 kaupa', value: 'count-5' },
  { label: 'Tähestik', value: 'alphabet' },
]

export const CONNECT_DOTS_INTERACTION_MODE_OPTIONS: Array<{
  label: string
  value: ConnectDotsInteractionMode
}> = [
  { label: 'Klõpsa', value: 'click' },
  { label: 'Lohista', value: 'trace' },
]

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export function getContainedImageRect(
  containerWidth: number,
  containerHeight: number,
  imageWidth?: number | null,
  imageHeight?: number | null,
): ConnectDotsContainedRect {
  if (!containerWidth || !containerHeight) {
    return { left: 0, top: 0, width: 0, height: 0 }
  }

  if (!imageWidth || !imageHeight) {
    return { left: 0, top: 0, width: containerWidth, height: containerHeight }
  }

  const containerAspectRatio = containerWidth / containerHeight
  const imageAspectRatio = imageWidth / imageHeight

  if (imageAspectRatio > containerAspectRatio) {
    const width = containerWidth
    const height = width / imageAspectRatio

    return {
      left: 0,
      top: (containerHeight - height) / 2,
      width,
      height,
    }
  }

  const height = containerHeight
  const width = height * imageAspectRatio

  return {
    left: (containerWidth - width) / 2,
    top: 0,
    width,
    height,
  }
}

export function getNormalizedPointFromContainedRect(args: {
  bounds: Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>
  clientX: number
  clientY: number
  rect: ConnectDotsContainedRect
}): ConnectDotsPoint | null {
  const { bounds, clientX, clientY, rect } = args

  if (!rect.width || !rect.height) {
    return null
  }

  const x = clientX - bounds.left
  const y = clientY - bounds.top

  if (x < rect.left || x > rect.left + rect.width || y < rect.top || y > rect.top + rect.height) {
    return null
  }

  return {
    x: clamp01((x - rect.left) / rect.width),
    y: clamp01((y - rect.top) / rect.height),
  }
}

export function normalizeDots(value: unknown): ConnectDotsPoint[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const point = entry as Record<string, unknown>
      const x = typeof point.x === 'number' ? point.x : Number(point.x)
      const y = typeof point.y === 'number' ? point.y : Number(point.y)

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null
      }

      return {
        x: clamp01(x),
        y: clamp01(y),
      }
    })
    .filter((point): point is ConnectDotsPoint => point !== null)
}

export function validateConnectDotsDots(value: unknown): string | true {
  if (!Array.isArray(value)) {
    return 'Lisa pildile vähemalt 2 punkti.'
  }

  if (value.length < 2) {
    return 'Lisa pildile vähemalt 2 punkti.'
  }

  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object') {
      return `Punkt ${index + 1} on vigane.`
    }

    const point = entry as Record<string, unknown>
    const x = typeof point.x === 'number' ? point.x : Number(point.x)
    const y = typeof point.y === 'number' ? point.y : Number(point.y)

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return `Punkt ${index + 1} vajab korrektseid x/y koordinaate.`
    }

    if (x < 0 || x > 1 || y < 0 || y > 1) {
      return `Punkt ${index + 1} peab jääma pildi sisse.`
    }
  }

  return true
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items
  }

  const next = [...items]
  const [item] = next.splice(fromIndex, 1)

  if (typeof item === 'undefined') {
    return items
  }

  next.splice(toIndex, 0, item)
  return next
}

export function getConnectDotsLabel(mode: ConnectDotsCountMode, index: number): string {
  if (mode === 'alphabet') {
    return toAlphabetLabel(index)
  }

  const step = Number(mode.replace('count-', ''))
  return String((index + 1) * step)
}

export function getRevealOpacity(completedDots: number, totalDots: number): number {
  if (totalDots <= 1) {
    return 1
  }

  const progress = completedDots / totalDots
  return Math.min(1, 0.12 + progress * 0.88)
}

export function distanceBetweenPoints(
  first: { x: number; y: number },
  second: { x: number; y: number },
): number {
  const dx = first.x - second.x
  const dy = first.y - second.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function getMediaUrl(media: unknown): string | null {
  if (!media || typeof media !== 'object') {
    return null
  }

  const mediaDoc = media as Record<string, unknown>
  const url = mediaDoc.url

  if (typeof url === 'string' && url.length > 0) {
    return url
  }

  return null
}

export function serializeConnectDotsPuzzle(doc: MaybeRecord): ConnectDotsPuzzle | null {
  if (!doc) {
    return null
  }

  const image = (doc.image ?? null) as MaybeRecord
  const backgroundMusic = (doc.backgroundMusic ?? null) as MaybeRecord
  const uploadedImageUrl = getMediaUrl(image)
  const backgroundMusicUrl = getMediaUrl(backgroundMusic) || DEFAULT_CONNECT_DOTS_BACKGROUND_MUSIC_URL
  const externalImageUrl = typeof doc.externalImageURL === 'string' ? doc.externalImageURL : null
  const imageUrl = uploadedImageUrl || getSymbolProxyURL(externalImageUrl)
  const dots = normalizeDots(doc.dots)

  if (!imageUrl || dots.length < 2) {
    return null
  }

  return {
    backgroundMusicUrl,
    id: String(doc.id ?? ''),
    title: typeof doc.title === 'string' ? doc.title : 'Puzzle',
    description: typeof doc.description === 'string' ? doc.description : null,
    imageAlt: uploadedImageUrl && typeof image?.alt === 'string' ? image.alt : null,
    imageHeight: uploadedImageUrl && typeof image?.height === 'number' ? image.height : null,
    imageUrl,
    imageWidth: uploadedImageUrl && typeof image?.width === 'number' ? image.width : null,
    dots,
  }
}

function toAlphabetLabel(index: number): string {
  let value = index + 1
  let label = ''

  while (value > 0) {
    const remainder = (value - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    value = Math.floor((value - 1) / 26)
  }

  return label
}
