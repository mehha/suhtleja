// src/app/(frontend)/next/symbols/route.ts
import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { hasActiveMembership } from '@/utilities/membershipStatus'

export const runtime = 'nodejs'

type SymbolItem = {
  id: string
  title: string
  preview: string
  source: 'arasaac' | 'local' | 'openmoji'
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

async function findPreferredLocalMedia(payload: Awaited<ReturnType<typeof getPayload>>, q: string) {
  const exactAlt = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 1,
    pagination: false,
    where: {
      alt: {
        equals: q,
      },
    },
  })

  if (exactAlt.docs[0]?.id && exactAlt.docs[0]?.url) {
    return exactAlt.docs[0]
  }

  const looseMatch = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 1,
    pagination: false,
    where: {
      or: [
        {
          alt: {
            like: q,
          },
        },
        {
          filename: {
            like: q,
          },
        },
      ],
    },
  })

  return looseMatch.docs[0]?.id && looseMatch.docs[0]?.url ? looseMatch.docs[0] : null
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

  if (!q) return NextResponse.json({ items: [] })

  try {
    if (source === 'openmoji') {
      const r = await fetch('https://unpkg.com/openmoji@15.0.0/data/openmoji.json')
      const data = (await r.json()) as OpenMojiEntry[]
      const needle = q.toLowerCase()
      const items: SymbolItem[] = data
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
          raw: e,
        }))
      return NextResponse.json({ items })
    }

    if (preferLocal) {
      const localMedia = await findPreferredLocalMedia(payload, q)
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
