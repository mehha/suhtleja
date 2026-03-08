// src/app/(frontend)/boards/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import type { Board } from '@/payload-types'
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

export default async function BoardRunPage({ params: paramsPromise }: Args) {
  const { id } = await paramsPromise

  const { payload, user } = await getCurrentUser()

  if (!user) {
    redirect('/admin') // or your route
  }
  requireActiveMembership(user)

  const isParentMode = await isParentModeUtil()

  // will be filtered by access rules in Payload anyway
  const doc = await payload.findByID({
    collection: 'boards',
    id,
    depth: 2,
  }).catch(() => null)

  if (!doc) {
    notFound()
  }

  const board = doc as Board

  return (
    <>
      <PageClient />
      <Runner board={board} isParentMode={isParentMode} />
    </>
  )
}
