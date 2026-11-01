// src/app/(frontend)/boards/[id]/edit/page.tsx
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import BoardEditor from './BoardEditor/index'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import type { Board, User } from '@/payload-types'
import { findBoardForUser, getBoardOwnerId } from '@/utilities/findBoardForUser'
import { requireParentMode } from '@/utilities/uiMode'
import { requireActiveMembership } from '@/utilities/membership'
import { labelCase } from '@/utilities/labelCase'
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

  const board = await findBoardForUser(payload, user, id)

  if (!board) {
    notFound()
  }

  const isAdmin = user.role === 'admin'

  if (getBoardOwnerId(board) !== user.id) {
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

    // The collection's update access lets only the owner rename it.
    try {
      await payload.update({
        collection: 'boards',
        id: boardId,
        data: { name },
        overrideAccess: false,
        user,
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

  // The boards a card can open: those the user can read (own and shared), not this one.
  const linkable = await payload.find({
    collection: 'boards',
    where: { id: { not_equals: board.id } },
    select: { name: true },
    sort: 'name',
    depth: 0,
    pagination: false,
    overrideAccess: false,
    user,
  })

  return (
    <BoardEditor
      board={board}
      linkableBoards={linkable.docs.map((doc) => ({ id: doc.id, name: doc.name || 'Nimetu tahvel' }))}
      letterCase={labelCase((user as User).labelCase)}
      isAdmin={isAdmin}
      renameBoard={renameBoard}
      updateBoardHomeVisibility={updateBoardHomeVisibility}
      updateBoardVisibility={updateBoardVisibility}
    />
  )
}
