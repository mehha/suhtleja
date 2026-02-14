// src/app/(frontend)/next/symbols/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type SymbolItem = {
  id: string
  title: string
  preview: string
  source: 'arasaac' | 'openmoji'
  license: string
  attribution?: string
  raw?: any
}

async function fetchArasaac(locale: string, q: string, limit: number) {
  const r = await fetch(
    `https://api.arasaac.org/api/pictograms/${encodeURIComponent(locale)}/search/${encodeURIComponent(q)}`,
    { headers: { Accept: 'application/json' } },
  )
  if (!r.ok) return []
  const arr = await r.json()
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const source = (searchParams.get('source') || 'arasaac').toLowerCase()
  const limit = Math.min(Number(searchParams.get('limit') || 40), 100)

  if (!q) return NextResponse.json({ items: [] })

  try {
    if (source === 'openmoji') {
      const r = await fetch('https://unpkg.com/openmoji@15.0.0/data/openmoji.json')
      const data = await r.json()
      const needle = q.toLowerCase()
      const items: SymbolItem[] = data
        .filter((e: any) =>
          [e.annotation, ...(e.tags || [])].some((t: string) => String(t).toLowerCase().includes(needle)),
        )
        .slice(0, limit)
        .map((e: any) => ({
          id: `openmoji-${e.hexcode}`,
          title: e.annotation,
          preview: `https://unpkg.com/openmoji@15.0.0/color/svg/${e.hexcode}.svg`,
          source: 'openmoji',
          license: 'CC BY-SA 4.0 (OpenMoji)',
          attribution: '© OpenMoji',
          raw: e,
        }))
      return NextResponse.json({ items })
    }

    // ARASAAC defaults to combined `et + en` results when locale is not provided.
    // `locale` is still accepted for backwards compatibility.
    const requestedLocale = (searchParams.get('locale') || '').toLowerCase().trim()

    let items: SymbolItem[] = []

    if (requestedLocale) {
      items = await fetchArasaac(requestedLocale, q, limit)
      if (!items.length && requestedLocale !== 'en') {
        const fallback = await fetchArasaac('en', q, limit)
        if (fallback.length) items = fallback
      }
    } else {
      items = await fetchArasaacCombined(['et', 'en'], q, limit)
    }

    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] })
  }
}
