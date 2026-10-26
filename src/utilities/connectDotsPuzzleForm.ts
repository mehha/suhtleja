import {
  normalizeDots,
  type ConnectDotsPoint,
  validateConnectDotsDots,
} from '@/utilities/connectDots'
import { slugify } from 'payload/shared'

export type ParsedConnectDotsPuzzleForm = {
  description: null | string
  dots: ConnectDotsPoint[]
  enabled: boolean
  externalImageURL: string
  generateSlug: true
  image: null | number
  slug: string
  title: string
  visibleToAllUsers: boolean
}

const coerceCheckbox = (value: FormDataEntryValue | null): boolean =>
  value === 'true' || value === 'on' || value === '1'

const coerceOptionalId = (value: FormDataEntryValue | null): null | number => {
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  if (!normalized) return null

  if (!/^\d+$/.test(normalized)) {
    throw new Error('Pildi id on vigane.')
  }

  return Number(normalized)
}

export function parseConnectDotsPuzzleForm(
  formData: FormData,
  options?: { allowGlobalVisibility?: boolean },
): ParsedConnectDotsPuzzleForm {
  const rawTitle = formData.get('title')
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : ''

  if (!title) {
    throw new Error('Mängu pealkiri on kohustuslik.')
  }

  const rawDescription = formData.get('description')
  const description =
    typeof rawDescription === 'string' && rawDescription.trim() ? rawDescription.trim() : null

  const rawDots = formData.get('dots')
  let parsedDots: unknown = []

  if (typeof rawDots === 'string' && rawDots.trim()) {
    try {
      parsedDots = JSON.parse(rawDots)
    } catch {
      throw new Error('Punktide andmed on vigased.')
    }
  }

  const dots = normalizeDots(parsedDots)
  const dotsValidation = validateConnectDotsDots(dots)
  if (dotsValidation !== true) {
    throw new Error(dotsValidation)
  }

  const image = coerceOptionalId(formData.get('imageId'))
  const externalImageURLValue = formData.get('externalImageURL')
  const externalImageURL =
    typeof externalImageURLValue === 'string' ? externalImageURLValue.trim() : ''

  if (!image && !externalImageURL) {
    throw new Error('Vali mängu jaoks pilt või sümbol.')
  }

  return {
    description,
    dots,
    enabled: coerceCheckbox(formData.get('enabled')),
    externalImageURL,
    generateSlug: true,
    image,
    slug: slugify(title) || 'connect-dots-puzzle',
    title,
    visibleToAllUsers: options?.allowGlobalVisibility
      ? coerceCheckbox(formData.get('visibleToAllUsers'))
      : false,
  }
}
