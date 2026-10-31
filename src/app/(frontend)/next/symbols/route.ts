// src/app/(frontend)/next/symbols/route.ts
import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Media, User } from '@/payload-types'
import { findLibraryMedia, findOwnMedia } from '@/utilities/findLibraryMedia'
import { hasActiveMembership } from '@/utilities/membershipStatus'
import {
  isSymbolBank,
  searchSymbolBank,
  searchSymbolBankWithAiTerms,
} from '@/utilities/symbolSources'

export const runtime = 'nodejs'

const localItem = (media: Media, q: string, attribution: string) => ({
  id: `media-${media.id}`,
  title: (typeof media.alt === 'string' && media.alt.trim()) || q,
  preview: media.url,
  source: 'local' as const,
  license: 'Sisemine meedia',
  attribution,
})

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
  const requestedSource = (searchParams.get('source') || 'arasaac').toLowerCase()
  const bank = isSymbolBank(requestedSource) ? requestedSource : 'arasaac'
  const limit = Math.min(Number(searchParams.get('limit') || 40), 100)
  const preferLocal = searchParams.get('preferLocal') === 'true'
  const aiFallback = searchParams.get('aiFallback') === 'true'
  const requestedLocale = (searchParams.get('locale') || '').toLowerCase().trim()

  if (!q) return NextResponse.json({ items: [] })

  try {
    if (preferLocal) {
      // The member's own picture for the word first, then the shared library.
      const own = await findOwnMedia(payload, q, (user as User).id)
      if (own?.url) {
        return NextResponse.json({ items: [localItem(own, q, 'Minu pildid')] })
      }
      const library = await findLibraryMedia(payload, q)
      if (library?.url) {
        return NextResponse.json({ items: [localItem(library, q, 'Suhtleja meediakogu')] })
      }
    }

    const items = await searchSymbolBank(bank, q, { limit, locale: requestedLocale || undefined })

    if (items.length || !aiFallback) {
      return NextResponse.json({ items })
    }

    // Nothing for the word itself (usually an Estonian word without a translation).
    return NextResponse.json(await searchSymbolBankWithAiTerms(bank, q, limit))
  } catch {
    return NextResponse.json({ items: [] })
  }
}
