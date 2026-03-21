'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Board } from '@/payload-types'
import { requireActiveMembership } from '@/utilities/membership'
import { isOwnedByUser } from '@/utilities/sharedHomePreferences'

export async function reorderBoards(boardIds: string[]) {
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()
  const { user } = await payload.auth({ headers: requestHeaders })

  if (!user) {
    redirect('/admin')
  }
  requireActiveMembership(user)

  const docs = await Promise.all(
    boardIds.map((id) =>
      payload.findByID({
        collection: 'boards',
        id,
        depth: 0,
      }),
    ),
  )

  const ownedBoardIds = docs
    .filter((doc) => isOwnedByUser(doc as Board, user.id))
    .map((doc) => String(doc.id))

  await Promise.all(
    ownedBoardIds.map((id, index) =>
      payload.update({
        collection: 'boards',
        id,
        data: {
          order: index + 1,
        },
      }),
    ),
  )
}
