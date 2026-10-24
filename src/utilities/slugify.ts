import type { slugField } from 'payload'

type Slugify = NonNullable<NonNullable<Parameters<typeof slugField>[0]>['slugify']>

// Payload's default slugify strips non-ASCII letters, so "Kuidas see töötab" became
// "kuidas-see-ttab". Strip diacritics first so õ, ä, ö, ü, š and ž become o, a, o, u, s and z.
export const slugify = (value?: string | null): string | undefined =>
  value
    ?.normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')

export const slugifyField: Slugify = ({ valueToSlugify }) =>
  typeof valueToSlugify === 'string' ? slugify(valueToSlugify) : undefined
