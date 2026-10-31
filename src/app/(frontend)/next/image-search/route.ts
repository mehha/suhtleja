import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { searchPictureMedia, type PictureItem } from '@/utilities/findLibraryMedia'
import { hasActiveMembership } from '@/utilities/membershipStatus'
import { isSymbolBank, searchSymbolBanks, type SymbolBank } from '@/utilities/symbolSources'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// What the card editor's single picture search can be narrowed to.
type Scope = 'all' | 'library' | 'mine' | SymbolBank

// "Kõik allikad" searches these banks, each its own group. OpenMoji (emoji, not AAC symbols) only when
// chosen on its own.
const ALL_SCOPE_BANKS: readonly SymbolBank[] = ['arasaac', 'mulberry']

const SECTION_LIMIT = 12
const ALL_SCOPE_BANK_LIMIT = 24
const SINGLE_SOURCE_LIMIT = 40

function parseScope(value: string | null): Scope {
  const scope = (value || 'all').toLowerCase()
  if (scope === 'all' || scope === 'library' || scope === 'mine' || isSymbolBank(scope)) return scope
  return 'all'
}

/**
 * GET /next/image-search?q=&scope=
 * The card editor's picture search, grouped: the member's own pictures, the shared library and one
 * group per symbol bank (ARASAAC and Mulberry for `all`). A bank that finds nothing for the word itself
 * searches Groq's English terms: Mulberry always (its labels are English only), ARASAAC only when no
 * group found anything. Without a query it returns the newest own and library pictures and no symbols.
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
  const banks: readonly SymbolBank[] =
    scope === 'all' ? ALL_SCOPE_BANKS : isSymbolBank(scope) ? [scope] : []

  try {
    const pictures = (async () => {
      const mine: PictureItem[] =
        scope === 'all' || scope === 'mine'
          ? await searchPictureMedia(payload, {
              limit: single ? SINGLE_SOURCE_LIMIT : SECTION_LIMIT,
              q,
              scope: 'mine',
              userId,
            })
          : []
      const library: PictureItem[] =
        scope === 'all' || scope === 'library'
          ? await searchPictureMedia(payload, {
              // The member's own pictures in the library are already under "mine".
              excludeIds: mine.map((item) => item.mediaId),
              limit: single ? SINGLE_SOURCE_LIMIT : SECTION_LIMIT,
              q,
              scope: 'library',
              userId,
            })
          : []
      return { library, mine }
    })()

    const [{ library, mine }, symbols] = await Promise.all([
      pictures,
      q && banks.length
        ? searchSymbolBanks(banks, q, {
            limit: single ? SINGLE_SOURCE_LIMIT : ALL_SCOPE_BANK_LIMIT,
            othersFound: pictures.then((found) => found.mine.length + found.library.length > 0),
          })
        : null,
    ])

    return NextResponse.json({
      aiError: symbols?.aiError,
      banks: symbols?.results ?? [],
      library,
      mine,
    })
  } catch (error) {
    console.error('Image search failed', error)
    return NextResponse.json({ banks: [], library: [], mine: [] })
  }
}
