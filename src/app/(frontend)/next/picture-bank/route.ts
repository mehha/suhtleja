import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { listPictureBankCategories, listPictureBankPictures } from '@/utilities/findLibraryMedia'
import { hasActiveMembership } from '@/utilities/membershipStatus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /next/picture-bank — the picture bank's categories: `{ categories: [{ id, name, cover, count }] }`.
 * GET /next/picture-bank?folder=<id> — one category's pictures: `{ folder: { id, name }, pictures }`.
 * The card editor browses these when its search is empty (scripts/pildipank fills the bank).
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

  const folderParam = new URL(req.url).searchParams.get('folder')
  if (folderParam === null) {
    return NextResponse.json({ categories: await listPictureBankCategories(payload) })
  }

  const folderId = Number(folderParam)
  if (!Number.isInteger(folderId) || folderId <= 0) {
    return NextResponse.json({ error: 'invalid_folder' }, { status: 400 })
  }

  const category = await listPictureBankPictures(payload, folderId)
  if (!category) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ folder: { id: folderId, name: category.name }, pictures: category.pictures })
}
