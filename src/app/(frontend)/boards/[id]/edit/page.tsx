// src/app/(frontend)/boards/[id]/edit/page.tsx
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import BoardEditor from './BoardEditor/index'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import type { Board, User } from '@/payload-types'
import { requireParentMode } from '@/utilities/uiMode'
import { requireActiveMembership } from '@/utilities/membership'
import { ACTION_ERROR, type ActionResult } from '@/utilities/flashToast'

type Params = {
  id: string
}

export const dynamic = 'force-dynamic'

export default async function BoardEditPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { id } = await params

  await requireParentMode()

  const { payload, user } = await getCurrentUser()

  if (!user) {
    redirect('/admin')
  }
  requireActiveMembership(user)

  const doc = await payload
    .findByID({
      collection: 'boards',
      id,
      depth: 2,
    })
    .catch(() => null)

  if (!doc) {
    notFound()
  }

  const board = doc as Board

  const isAdmin = user.role === 'admin'
  const ownerId =
    typeof board.owner === 'object' && board.owner !== null
      ? (board.owner as User).id
      : board.owner

  if (ownerId !== user.id) {
    redirect('/kodu')
  }

  // --- server action: renameBoard ---
  async function renameBoard(formData: FormData): Promise<ActionResult> {
    'use server'

    const { payload, user } = await getCurrentUser()
    if (!user) {
      redirect('/admin')
    }
    requireActiveMembership(user)

    const boardId = formData.get('boardId') as string
    const rawName = (formData.get('name') as string) ?? ''
    const name = rawName.trim() || 'Nimetu tahvel'

    try {
      await payload.update({
        collection: 'boards',
        id: boardId, // ei kasuta where, meil on id olemas
        data: { name },
      })
    } catch (error) {
      console.error('renameBoard failed', error)
      return { ok: false, error: ACTION_ERROR }
    }

    revalidatePath(`/boards/${boardId}/edit`)
    revalidatePath('/koduhaldus')
    return { ok: true }
  }

  async function updateBoardVisibility(formData: FormData): Promise<ActionResult> {
    'use server'

    const { payload, user } = await getCurrentUser()
    if (!user) {
      redirect('/admin')
    }
    requireActiveMembership(user)

    if (user.role !== 'admin') {
      redirect('/kodu')
    }

    const boardId = formData.get('boardId') as string
    const visibleToAllUsers = formData.get('visibleToAllUsers') === 'true'

    try {
      await payload.update({
        collection: 'boards',
        id: boardId,
        data: { visibleToAllUsers },
      })
    } catch (error) {
      console.error('updateBoardVisibility failed', error)
      return { ok: false, error: ACTION_ERROR }
    }

    revalidatePath(`/boards/${boardId}/edit`)
    revalidatePath(`/boards/${boardId}`)
    revalidatePath('/koduhaldus')
    revalidatePath('/kodu')
    return { ok: true }
  }

  async function updateBoardHomeVisibility(formData: FormData): Promise<ActionResult> {
    'use server'

    const { payload, user } = await getCurrentUser()
    if (!user) {
      redirect('/admin')
    }
    requireActiveMembership(user)

    const boardId = formData.get('boardId') as string
    const pinned = formData.get('pinned') === 'true'

    const currentBoard = (await payload
      .findByID({
        collection: 'boards',
        id: boardId,
        depth: 0,
      })
      .catch(() => null)) as Board | null

    if (!currentBoard) {
      return { ok: false, error: ACTION_ERROR }
    }

    const currentOwnerId =
      typeof currentBoard.owner === 'object' && currentBoard.owner !== null
        ? (currentBoard.owner as User).id
        : currentBoard.owner

    if (user.role !== 'admin' && currentOwnerId !== user.id) {
      redirect('/kodu')
    }

    try {
      await payload.update({
        collection: 'boards',
        id: boardId,
        data: { pinned },
      })
    } catch (error) {
      console.error('updateBoardHomeVisibility failed', error)
      return { ok: false, error: ACTION_ERROR }
    }

    revalidatePath(`/boards/${boardId}/edit`)
    revalidatePath(`/boards/${boardId}`)
    revalidatePath('/koduhaldus')
    revalidatePath('/kodu')
    return { ok: true }
  }

  return (
    <BoardEditor
      board={board}
      isAdmin={isAdmin}
      renameBoard={renameBoard}
      updateBoardHomeVisibility={updateBoardHomeVisibility}
      updateBoardVisibility={updateBoardVisibility}
    />
  )
}
