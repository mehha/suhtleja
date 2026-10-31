import { getSymbolSearchTerms } from './groq'

// Pictogram banks searched by /next/symbols and /next/image-search. Every item carries its licence and
// attribution; keep them (see docs/rules/project/symbols-ai.md).

export type SymbolBank = 'arasaac' | 'mulberry' | 'openmoji'

export const SYMBOL_BANKS: readonly SymbolBank[] = ['arasaac', 'mulberry', 'openmoji']

export type SymbolItem = {
  id: string
  title: string
  preview: string
  source: SymbolBank
  license: string
  attribution?: string
}

type ArasaacPictogram = {
  _id: number | string
  keywords?: Array<{ keyword?: string }>
}

type GlobalSymbolsLabel = {
  text?: string
  picto?: { id?: number; image_url?: string }
}

type OpenMojiEntry = {
  annotation: string
  hexcode: string
  tags?: string[]
}

export function isSymbolBank(value: string): value is SymbolBank {
  return (SYMBOL_BANKS as readonly string[]).includes(value)
}

async function fetchArasaac(locale: string, q: string, limit: number): Promise<SymbolItem[]> {
  const r = await fetch(
    `https://api.arasaac.org/api/pictograms/${encodeURIComponent(locale)}/search/${encodeURIComponent(q)}`,
    { headers: { Accept: 'application/json' } },
  )
  if (!r.ok) return []
  const pictograms = (await r.json()) as ArasaacPictogram[]
  return (pictograms || []).slice(0, limit).map((p) => ({
    id: `arasaac-${p._id}`,
    title: p.keywords?.[0]?.keyword || q,
    preview: `https://static.arasaac.org/pictograms/${p._id}/${p._id}_500.png?download=false&color=true`,
    source: 'arasaac',
    license: 'CC BY-NC-SA 4.0 (ARASAAC)',
    attribution: '© ARASAAC (Gobierno de Aragón); author listed on symbol page',
  }))
}

async function fetchArasaacCombined(locales: string[], q: string, limit: number) {
  const byLocale = await Promise.all(
    locales.map((locale) => fetchArasaac(locale, q, limit).catch(() => [] as SymbolItem[])),
  )
  return mergeUnique(byLocale, limit)
}

// Mulberry Symbols (CC BY-SA 4.0, commercial use allowed) through the Global Symbols API. Its labels are
// English only, so Estonian words find them through the AI search terms.
async function fetchMulberry(q: string, limit: number): Promise<SymbolItem[]> {
  const params = new URLSearchParams({
    language: 'eng',
    limit: String(limit),
    query: q,
    symbolset: 'mulberry',
  })
  const r = await fetch(`https://globalsymbols.com/api/v1/labels/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) return []
  const labels = (await r.json()) as GlobalSymbolsLabel[]
  const items: SymbolItem[] = []
  const seen = new Set<number>()

  for (const label of Array.isArray(labels) ? labels : []) {
    const id = label.picto?.id
    const preview = label.picto?.image_url
    if (typeof id !== 'number' || typeof preview !== 'string' || seen.has(id)) continue
    seen.add(id)
    items.push({
      id: `mulberry-${id}`,
      title: label.text || q,
      preview,
      source: 'mulberry',
      license: 'CC BY-SA 4.0 (Mulberry Symbols)',
      attribution: '© Steve Lee, Mulberry Symbols (globalsymbols.com)',
    })
  }

  return items
}

async function fetchOpenMoji(q: string, limit: number): Promise<SymbolItem[]> {
  const r = await fetch('https://unpkg.com/openmoji@15.0.0/data/openmoji.json')
  const data = (await r.json()) as OpenMojiEntry[]
  const needle = q.toLowerCase()
  return data
    .filter((e) =>
      [e.annotation, ...(e.tags || [])].some((t) => String(t).toLowerCase().includes(needle)),
    )
    .slice(0, limit)
    .map((e) => ({
      id: `openmoji-${e.hexcode}`,
      title: e.annotation,
      preview: `https://unpkg.com/openmoji@15.0.0/color/svg/${e.hexcode}.svg`,
      source: 'openmoji',
      license: 'CC BY-SA 4.0 (OpenMoji)',
      attribution: '© OpenMoji',
    }))
}

export function mergeUnique<T extends { id: string }>(lists: T[][], limit: number): T[] {
  const merged: T[] = []
  const seen = new Set<string>()

  for (const item of lists.flat()) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
    if (merged.length >= limit) break
  }

  return merged
}

/**
 * One bank's results for a query. ARASAAC without a locale searches Estonian and English; with a
 * locale it falls back to English. Mulberry and OpenMoji ignore the locale.
 */
export async function searchSymbolBank(
  bank: SymbolBank,
  q: string,
  { limit, locale }: { limit: number; locale?: string },
): Promise<SymbolItem[]> {
  if (bank === 'openmoji') return fetchOpenMoji(q, limit)
  if (bank === 'mulberry') return fetchMulberry(q, limit)
  if (locale) {
    const items = await fetchArasaac(locale, q, limit)
    if (items.length || locale === 'en') return items
    return fetchArasaac('en', q, limit)
  }
  return fetchArasaacCombined(['et', 'en'], q, limit)
}

/**
 * The English terms Groq suggests for a word without a direct match, searched in the same bank. Each
 * term gets an equal share of the limit: the banks match prefixes, so one term ("break") could
 * otherwise fill every slot with near misses ("breakfast") and hide the other terms.
 */
export async function searchSymbolBankWithAiTerms(
  bank: SymbolBank,
  q: string,
  limit: number,
): Promise<{ aiError?: string; aiTerms?: string[]; items: SymbolItem[] }> {
  const { error, terms } = await getSymbolSearchTerms(q)
  if (!terms.length) {
    return error ? { aiError: error, items: [] } : { items: [] }
  }

  const perTermLimit = Math.max(4, Math.ceil(limit / terms.length))
  const perTerm = await Promise.all(
    terms.map((term) =>
      searchSymbolBank(bank, term, { limit, locale: 'en' })
        .then((items) => items.slice(0, perTermLimit))
        .catch(() => [] as SymbolItem[]),
    ),
  )

  return { aiTerms: terms, items: mergeUnique(perTerm, limit) }
}
