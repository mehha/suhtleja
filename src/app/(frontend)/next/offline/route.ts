import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { hasActiveMembership } from '@/utilities/membershipStatus'
import { buildOfflineList } from '@/utilities/offlineList'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /next/offline — what this device keeps for the child to use without the network:
 * `{ userId, pages: [{ url, version }], media: [url] }` (src/utilities/offlineList.ts). The child's
 * pages fetch it and fill the device's caches (src/utilities/offlineCache.ts).
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

  const list = await buildOfflineList(payload, user as User)
  return NextResponse.json(list, { headers: { 'Cache-Control': 'private, no-store' } })
}
