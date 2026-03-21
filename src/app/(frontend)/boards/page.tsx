// src/app/(frontend)/boards/page.tsx
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Board } from '@/payload-types'
import { BoardsList } from './BoardsList'
import { ConnectDotsBoardsList, type ConnectDotsBoardsPuzzle } from './ConnectDotsBoardsList'
import { CreateBoardForm } from './CreateBoardForm'
import { requireParentMode } from '@/utilities/uiMode'
import { requireActiveMembership } from '@/utilities/membership'

export const dynamic = 'force-dynamic'

export default async function BoardsPage() {
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()

  const { user } = await payload.auth({ headers: requestHeaders })

  await requireParentMode()

  if (!user) redirect('/admin')
  requireActiveMembership(user)

  const isAdmin = user.role === 'admin'

  const boardsRes = await payload.find({
    collection: 'boards',
    where: isAdmin
      ? {} // admin näeb kõiki tahvleid
      : {
          owner: { equals: user.id },
        },
    sort: 'createdAt',
    depth: 1,
  })

  const boards = boardsRes.docs as Board[]
  const puzzlesRes = await payload.find({
    collection: 'connect-dots-puzzles',
    depth: 1,
    overrideAccess: false,
    sort: 'updatedAt',
    user,
    where: isAdmin
      ? {}
      : {
          owner: {
            equals: user.id,
          },
        },
  })

  const puzzles = puzzlesRes.docs as unknown as ConnectDotsBoardsPuzzle[]

  // --- server actions ---

  async function createBoard(formData: FormData) {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })
    if (!user) redirect('/admin')
    requireActiveMembership(user)

    const rawName = formData.get('name')
    const name = typeof rawName === 'string' ? rawName.trim() : ''

    if (!name) {
      return
    }

    await payload.create({
      collection: 'boards',
      data: {
        name,
        owner: user.id,
        grid: { cols: 6, rows: 8, cells: [] },
        pinned: false, // vaikimisi mitte koduvaates
      },
    })

    redirect('/boards')
  }

  async function togglePinned(formData: FormData) {
    'use server'

    const boardId = formData.get('boardId') as string
    const pinned = formData.get('pinned') === 'true'

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })
    if (!user) redirect('/admin')
    requireActiveMembership(user)

    await payload.update({
      collection: 'boards',
      id: boardId,
      data: { pinned },
    })

    redirect('/boards')
  }

  async function deleteBoard(formData: FormData) {
    'use server'

    const boardId = formData.get('boardId')

    if (!boardId || typeof boardId !== 'string') {
      console.error('Missing boardId in deleteBoard', boardId)
      throw new Error('boardId puudub FormData-st')
    }

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })
    if (!user) redirect('/admin')
    requireActiveMembership(user)

    await payload.delete({ collection: 'boards', id: boardId })

    redirect('/boards')
  }

  async function togglePuzzlePinned(formData: FormData) {
    'use server'

    const puzzleId = formData.get('puzzleId') as string
    const pinned = formData.get('pinned') === 'true'

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })
    if (!user) redirect('/admin')
    requireActiveMembership(user)

    await payload.update({
      collection: 'connect-dots-puzzles',
      id: puzzleId,
      data: { pinned },
      overrideAccess: false,
      user,
    })

    redirect('/boards')
  }

  async function deletePuzzle(formData: FormData) {
    'use server'

    const puzzleId = formData.get('puzzleId')
    if (!puzzleId || typeof puzzleId !== 'string') {
      throw new Error('Puzzle id puudub.')
    }

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })
    if (!user) redirect('/admin')
    requireActiveMembership(user)

    await payload.delete({
      collection: 'connect-dots-puzzles',
      id: puzzleId,
      overrideAccess: false,
      user,
    })

    redirect('/boards')
  }

  return (
    <main className="container space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Kõik tahvlid</h1>
        <CreateBoardForm createBoard={createBoard} />
      </header>

      <BoardsList
        boards={boards}
        isAdmin={isAdmin}
        togglePinned={togglePinned}
        deleteBoard={deleteBoard}
      />

      <div className="pt-4 md:pt-6">
        <ConnectDotsBoardsList
          deletePuzzle={deletePuzzle}
          isAdmin={isAdmin}
          puzzles={puzzles}
          togglePinned={togglePuzzlePinned}
        />
      </div>
    </main>
  )
}
