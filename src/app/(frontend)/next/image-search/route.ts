import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { searchPictureMedia, type PictureItem } from '@/utilities/findLibraryMedia'
import { hasActiveMembership } from '@/utilities/membershipStatus'
import {
  isSymbolBank,
  searchSymbolBank,
  searchSymbolBankWithAiTerms,
  type SymbolBank,
  type SymbolItem,
} from '@/utilities/symbolSources'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// What the card editor's single picture search can be narrowed to.
type Scope = 'all' | 'library' | 'mine' | SymbolBank

const SECTION_LIMIT = 12
const SINGLE_SOURCE_LIMIT = 40

function parseScope(value: string | null): Scope {
  const scope = (value || 'all').toLowerCase()
  if (scope === 'all' || scope === 'library' || scope === 'mine' || isSymbolBank(scope)) return scope
  return 'all'
}

/**
 * GET /next/image-search?q=&scope=
 * The card editor's picture search, grouped: the member's own pictures, the shared library and one
 * symbol bank (ARASAAC for `all`). Groq's English terms are only tried when every group is empty.
 * Without a query it returns the newest own and library pictures and no symbols.
 */
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
  const q = (searchParams.get('q') || '').trim().slice(0, 80)
  const scope = parseScope(searchParams.get('scope'))
  const userId = (user as User).id
  const single = scope !== 'all'
  const bank: SymbolBank | null = isSymbolBank(scope) ? scope : scope === 'all' ? 'arasaac' : null

  try {
    const mine: PictureItem[] =
      scope === 'all' || scope === 'mine'
        ? await searchPictureMedia(payload, {
            limit: single ? SINGLE_SOURCE_LIMIT : SECTION_LIMIT,
            q,
            scope: 'mine',
            userId,
          })
        : []

    const [library, symbols] = await Promise.all([
      scope === 'all' || scope === 'library'
        ? searchPictureMedia(payload, {
            // The member's own pictures in the library are already under "mine".
            excludeIds: mine.map((item) => item.mediaId),
            limit: single ? SINGLE_SOURCE_LIMIT : SECTION_LIMIT,
            q,
            scope: 'library',
            userId,
          })
        : Promise.resolve([] as PictureItem[]),
      bank && q
        ? searchSymbolBank(bank, q, { limit: SINGLE_SOURCE_LIMIT }).catch(() => [] as SymbolItem[])
        : Promise.resolve([] as SymbolItem[]),
    ])

    if (!bank || !q || mine.length || library.length || symbols.length) {
      return NextResponse.json({ library, mine, symbols })
    }

    const fallback = await searchSymbolBankWithAiTerms(bank, q, SINGLE_SOURCE_LIMIT)
    return NextResponse.json({
      aiError: fallback.aiError,
      aiTerms: fallback.aiTerms,
      library,
      mine,
      symbols: fallback.items,
    })
  } catch (error) {
    console.error('Image search failed', error)
    return NextResponse.json({ library: [], mine: [], symbols: [] })
  }
}
