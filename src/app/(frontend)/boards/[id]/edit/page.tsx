// src/app/(frontend)/boards/[id]/edit/page.tsx
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import BoardEditor from './BoardEditor/index'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import type { Board, User } from '@/payload-types'
import { requireParentMode } from '@/utilities/uiMode'
import { requireActiveMembership } from '@/utilities/membership'

type Params = {
  id: string
}

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

  if (!isAdmin && ownerId !== user.id) {
    redirect('/home')
  }

  // --- server action: renameBoard ---
  async function renameBoard(formData: FormData) {
    'use server'

    const { payload, user } = await getCurrentUser()
    if (!user) {
      redirect('/admin')
    }
    requireActiveMembership(user)

    const boardId = formData.get('boardId') as string
    const rawName = (formData.get('name') as string) ?? ''
    const name = rawName.trim() || 'Nimetu tahvel'

    await payload.update({
      collection: 'boards',
      id: boardId, // ei kasuta where, meil on id olemas
      data: { name },
    })

    revalidatePath(`/boards/${boardId}/edit`)
    revalidatePath('/boards')
  }

  async function updateBoardVisibility(formData: FormData) {
    'use server'

    const { payload, user } = await getCurrentUser()
    if (!user) {
      redirect('/admin')
    }
    requireActiveMembership(user)

    if (user.role !== 'admin') {
      redirect('/home')
    }

    const boardId = formData.get('boardId') as string
    const visibleToAllUsers = formData.get('visibleToAllUsers') === 'true'

    await payload.update({
      collection: 'boards',
      id: boardId,
      data: { visibleToAllUsers },
    })

    revalidatePath(`/boards/${boardId}/edit`)
    revalidatePath(`/boards/${boardId}`)
    revalidatePath('/boards')
    revalidatePath('/home')
  }

  return (
    <BoardEditor
      board={board}
      isAdmin={isAdmin}
      renameBoard={renameBoard}
      updateBoardVisibility={updateBoardVisibility}
    />
  )
}
