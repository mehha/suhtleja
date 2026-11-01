// src/app/(frontend)/boards/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import type { User } from '@/payload-types'
import { findBoardForUser, getBoardOwnerId } from '@/utilities/findBoardForUser'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import Runner from './Runner'
import PageClient from './page.client'
import React from 'react'
import { isParentModeUtil } from '@/utilities/uiMode'
import { requireActiveMembership } from '@/utilities/membership'

type Args = {
  params: Promise<{
    id: string
  }>
  // The board a card opened this one from, for the back button.
  searchParams: Promise<{ from?: string }>
}

export const dynamic = 'force-dynamic'

export default async function BoardRunPage({ params: paramsPromise, searchParams }: Args) {
  const { id } = await paramsPromise
  const { from } = await searchParams

  const { payload, user } = await getCurrentUser()

  if (!user) {
    redirect('/admin') // or your route
  }
  requireActiveMembership(user)

  const isParentMode = await isParentModeUtil()

  // Another user's private board is not found, the same as a missing one.
  const board = await findBoardForUser(payload, user, id)

  if (!board) {
    notFound()
  }

  const canEdit = getBoardOwnerId(board) === user.id

  // The boards the cards open, and the one this was opened from, that the user can read: a card
  // whose board is gone or private to someone else is an ordinary card.
  const fromId = Number(from) || null
  const boardIds = new Set<number>()
  for (const cell of board.grid?.cells ?? []) {
    if (typeof cell.linkBoard === 'number' && cell.linkBoard !== board.id) boardIds.add(cell.linkBoard)
  }
  if (fromId && fromId !== board.id) boardIds.add(fromId)
  const linkedBoards: Record<number, string> = {}
  if (boardIds.size > 0) {
    const found = await payload.find({
      collection: 'boards',
      where: { id: { in: [...boardIds] } },
      select: { name: true },
      depth: 0,
      pagination: false,
      overrideAccess: false,
      user,
    })
    for (const doc of found.docs) linkedBoards[doc.id] = doc.name || 'Nimetu tahvel'
  }
  const backTo = fromId && linkedBoards[fromId] ? { id: fromId, name: linkedBoards[fromId] } : null

  return (
    <>
      <PageClient />
      <Runner
        board={board}
        isParentMode={isParentMode}
        canEdit={canEdit}
        hasPin={Boolean((user as User).parentPinHash)}
        linkedBoards={linkedBoards}
        backTo={backTo}
      />
    </>
  )
}
