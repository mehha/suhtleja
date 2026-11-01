import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import type { User } from '@/payload-types'
import { findBoardForUser } from '@/utilities/findBoardForUser'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { labelCase } from '@/utilities/labelCase'
import { requireActiveMembership } from '@/utilities/membership'
import { requireParentMode } from '@/utilities/uiMode'
import { PrintBoard } from './PrintBoard'

type Args = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { robots: { index: false } }

// A board on paper (docs/rules/project/boards.md, "Printing"): its cards in its own layout, for a
// child without a tablet at hand. The parent view prints any board the member can read.
export default async function BoardPrintPage({ params }: Args) {
  const { id } = await params

  await requireParentMode()
  const { payload, user } = await getCurrentUser()
  if (!user) redirect('/admin')
  requireActiveMembership(user)

  const board = await findBoardForUser(payload, user, id)
  if (!board) notFound()

  return <PrintBoard board={board} letterCase={labelCase((user as User).labelCase)} />
}
