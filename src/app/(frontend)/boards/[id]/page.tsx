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
}

export const dynamic = 'force-dynamic'

export default async function BoardRunPage({ params: paramsPromise }: Args) {
  const { id } = await paramsPromise

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

  return (
    <>
      <PageClient />
      <Runner
        board={board}
        isParentMode={isParentMode}
        canEdit={canEdit}
        hasPin={Boolean((user as User).parentPinHash)}
      />
    </>
  )
}
