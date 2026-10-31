// src/app/(frontend)/next/symbols/route.ts
import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { findLibraryMedia } from '@/utilities/findLibraryMedia'
import { getSymbolSearchTerms } from '@/utilities/groq'
import { hasActiveMembership } from '@/utilities/membershipStatus'

export const runtime = 'nodejs'

type SymbolItem = {
  id: string
  title: string
  preview: string
  source: 'arasaac' | 'local' | 'mulberry' | 'openmoji'
  license: string
  attribution?: string
  raw?: any
}

type ArasaacPictogram = {
  _id: string
  keywords?: Array<{ keyword?: string }>
}

type OpenMojiEntry = {
  annotation: string
  hexcode: string
  tags?: string[]
}

async function fetchArasaac(locale: string, q: string, limit: number) {
  const r = await fetch(
    `https://api.arasaac.org/api/pictograms/${encodeURIComponent(locale)}/search/${encodeURIComponent(q)}`,
    { headers: { Accept: 'application/json' } },
  )
  if (!r.ok) return []
  const arr = (await r.json()) as ArasaacPictogram[]
  return (arr || []).slice(0, limit).map((p: any) => ({
    id: `arasaac-${p._id}`,
    title: p.keywords?.[0]?.keyword || q,
    preview: `https://static.arasaac.org/pictograms/${p._id}/${p._id}_500.png?download=false&color=true`,
    source: 'arasaac' as const,
    license: 'CC BY-NC-SA 4.0 (ARASAAC)',
    attribution: '© ARASAAC (Gobierno de Aragón); author listed on symbol page',
    raw: p,
  })) as SymbolItem[]
}

type GlobalSymbolsLabel = {
  text?: string
  picto?: { id?: number; image_url?: string }
}

// Mulberry Symbols (CC BY-SA 4.0, commercial use allowed) through the Global Symbols API. Its labels are
// English only, so Estonian words find them through the AI search terms.
async function fetchMulberry(q: string, limit: number) {
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

function mergeUnique(lists: SymbolItem[][], limit: number) {
  const merged: SymbolItem[] = []
  const seen = new Set<string>()

  for (const item of lists.flat()) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
    if (merged.length >= limit) break
  }

  return merged
}

async function fetchArasaacCombined(locales: string[], q: string, limit: number) {
  const byLocale = await Promise.all(
    locales.map(async (locale) => {
      try {
        return await fetchArasaac(locale, q, limit)
      } catch {
        return []
      }
    }),
  )

  const merged = byLocale.flat()
  const deduped: SymbolItem[] = []
  const seen = new Set<string>()

  for (const item of merged) {
    const pictogramId = item.id.replace('arasaac-', '')
    if (seen.has(pictogramId)) continue
    seen.add(pictogramId)
    deduped.push(item)
    if (deduped.length >= limit) break
  }

  return deduped
}

async function fetchOpenMoji(q: string, limit: number) {
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
      source: 'openmoji' as const,
      license: 'CC BY-SA 4.0 (OpenMoji)',
      attribution: '© OpenMoji',
      raw: e,
    }))
}

export async function GET(req: Request) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!hasActiveMembership(user as User)) {
    return NextResponse.json({ error: 'membership_required' }, { status: 402 })
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const source = (searchParams.get('source') || 'arasaac').toLowerCase()
  const limit = Math.min(Number(searchParams.get('limit') || 40), 100)
  const preferLocal = searchParams.get('preferLocal') === 'true'
  const aiFallback = searchParams.get('aiFallback') === 'true'

  if (!q) return NextResponse.json({ items: [] })

  const search = async (query: string, locale?: string): Promise<SymbolItem[]> => {
    if (source === 'openmoji') return fetchOpenMoji(query, limit)
    if (source === 'mulberry') return fetchMulberry(query, limit)
    if (locale) {
      const items = await fetchArasaac(locale, query, limit)
      if (items.length || locale === 'en') return items
      return fetchArasaac('en', query, limit)
    }
    return fetchArasaacCombined(['et', 'en'], query, limit)
  }

  try {
    if (preferLocal) {
      const localMedia = await findLibraryMedia(payload, q)
      if (localMedia?.id && localMedia.url) {
        return NextResponse.json({
          items: [
            {
              id: `media-${localMedia.id}`,
              title:
                (typeof localMedia.alt === 'string' && localMedia.alt.trim()) || q,
              preview: localMedia.url,
              source: 'local',
              license: 'Sisemine meedia',
              attribution: 'Suhtleja meediakogu',
              raw: localMedia,
            },
          ],
        })
      }
    }

    const requestedLocale = (searchParams.get('locale') || '').toLowerCase().trim()
    const items = await search(q, requestedLocale || undefined)

    if (items.length || !aiFallback) {
      return NextResponse.json({ items })
    }

    // Nothing for the word itself (usually an Estonian word without a translation): search the English
    // terms Groq suggests and merge them in the order Groq ranked them.
    const { error, terms } = await getSymbolSearchTerms(q)
    if (!terms.length) {
      return NextResponse.json(error ? { aiError: error, items: [] } : { items: [] })
    }

    // Share the results between the terms: the sources match prefixes, so one term ("break") could
    // otherwise fill every slot with near misses ("breakfast") and hide the other terms.
    const perTermLimit = Math.max(4, Math.ceil(limit / terms.length))
    const perTerm = await Promise.all(
      terms.map((term) =>
        search(term, 'en')
          .then((items) => items.slice(0, perTermLimit))
          .catch(() => []),
      ),
    )
    return NextResponse.json({ aiTerms: terms, items: mergeUnique(perTerm, limit) })
  } catch {
    return NextResponse.json({ items: [] })
  }
}
