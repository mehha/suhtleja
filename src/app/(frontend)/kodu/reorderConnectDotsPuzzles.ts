'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireActiveMembership } from '@/utilities/membership'
import { isOwnedByUser } from '@/utilities/sharedHomePreferences'

export async function reorderConnectDotsPuzzles(puzzleIds: string[]) {
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()
  const { user } = await payload.auth({ headers: requestHeaders })

  if (!user) {
    redirect('/admin')
  }
  requireActiveMembership(user)

  const docs = await Promise.all(
    puzzleIds.map((id) =>
      payload.findByID({
        collection: 'connect-dots-puzzles',
        id,
        depth: 0,
        overrideAccess: false,
        user,
      }),
    ),
  )

  const ownedPuzzleIds = docs
    .filter((doc) => isOwnedByUser(doc, user.id))
    .map((doc) => String(doc.id))

  await Promise.all(
    ownedPuzzleIds.map((id, index) =>
      payload.update({
        collection: 'connect-dots-puzzles',
        id,
        data: {
          order: index + 1,
        },
        overrideAccess: false,
        user,
      }),
    ),
  )
}
