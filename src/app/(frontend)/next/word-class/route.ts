import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { hasActiveMembership } from '@/utilities/membershipStatus'
import { findWordClasses } from '@/utilities/wordClassLookup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_WORDS = 60
const MAX_WORD_LENGTH = 80

/**
 * GET /next/word-class?word=koer&word=sööma — the word class the card editor suggests for each card
 * text: `{ classes: { koer: 'noun', sööma: 'verb' } }`, null where nothing is known
 * (src/utilities/wordClass.ts). The card editor asks while the text is typed, bulk add once for
 * all its cards.
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

  const words = [
    ...new Set(
      new URL(req.url).searchParams
        .getAll('word')
        .map((word) => word.trim())
        .filter((word) => word && word.length <= MAX_WORD_LENGTH),
    ),
  ].slice(0, MAX_WORDS)

  return NextResponse.json({ classes: await findWordClasses(payload, words) })
}
