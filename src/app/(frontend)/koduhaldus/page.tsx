// src/app/(frontend)/koduhaldus/page.tsx
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Board } from '@/payload-types'
import { BoardsList, type BoardsListBoard } from '../boards/BoardsList'
import { ConnectDotsBoardsList, type ConnectDotsBoardsPuzzle } from '../boards/ConnectDotsBoardsList'
import { CreateBoardForm } from '../boards/CreateBoardForm'
import { requireParentMode } from '@/utilities/uiMode'
import { requireActiveMembership } from '@/utilities/membership'
import { withToast, type FlashToastKey } from '@/utilities/flashToast'
import {
  getUserSharedHomePreferences,
  isOwnedByUser,
  setHiddenState,
  toIdString,
} from '@/utilities/sharedHomePreferences'

export const dynamic = 'force-dynamic'

export default async function ActivitiesPage() {
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()

  const { user } = await payload.auth({ headers: requestHeaders })

  await requireParentMode()

  if (!user) redirect('/admin')
  requireActiveMembership(user)

  const isAdmin = user.role === 'admin'
  const preferences = getUserSharedHomePreferences(user)

  const boardsRes = await payload.find({
    collection: 'boards',
    where: isAdmin
      ? {}
      : {
          or: [
            {
              owner: { equals: user.id },
            },
            {
              visibleToAllUsers: { equals: true },
            },
          ],
        },
    sort: 'createdAt',
    depth: 1,
  })

  const boards = boardsRes.docs.map((doc) => {
    const board = doc as Board
    const isOwnedByCurrentUser = isOwnedByUser(board, user.id)
    const boardId = toIdString(board.id) ?? ''

    return {
      ...board,
      homeVisible: isOwnedByCurrentUser
        ? board.pinned === true
        : board.visibleToAllUsers
          ? !preferences.hiddenSharedBoardIds.includes(boardId)
          : board.pinned === true,
      isOwnedByCurrentUser,
    }
  }) as BoardsListBoard[]
  const puzzlesRes = await payload.find({
    collection: 'connect-dots-puzzles',
    depth: 1,
    overrideAccess: false,
    sort: 'updatedAt',
    user,
    where: isAdmin
      ? {}
      : {
          or: [
            {
              owner: {
                equals: user.id,
              },
            },
            {
              visibleToAllUsers: {
                equals: true,
              },
            },
          ],
        },
  })

  const puzzles = puzzlesRes.docs.map((doc) => {
    const puzzle = doc as unknown as ConnectDotsBoardsPuzzle & {
      owner?: Board['owner']
      pinned?: boolean | null
    }
    const isOwnedByCurrentUser = isOwnedByUser(puzzle, user.id)
    const puzzleId = toIdString(puzzle.id) ?? ''

    return {
      ...puzzle,
      homeVisible: isOwnedByCurrentUser
        ? puzzle.pinned === true
        : puzzle.visibleToAllUsers
          ? !preferences.hiddenSharedPuzzleIds.includes(puzzleId)
          : puzzle.pinned === true,
      isOwnedByCurrentUser,
    }
  }) as ConnectDotsBoardsPuzzle[]

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

    let createdBoardId: number | string | null = null
    try {
      const createdBoard = await payload.create({
        collection: 'boards',
        data: {
          name,
          owner: user.id,
          grid: { cols: 6, rows: 8, cells: [] },
          pinned: false, // vaikimisi mitte koduvaates
        },
      })
      createdBoardId = createdBoard.id
    } catch (error) {
      console.error('createBoard failed', error)
    }

    redirect(
      createdBoardId === null
        ? withToast('/koduhaldus', 'error')
        : withToast(`/boards/${createdBoardId}/edit`, 'board-created'),
    )
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

    let toastKey: FlashToastKey = pinned ? 'board-pinned' : 'board-unpinned'
    try {
      const doc = await payload.findByID({
        collection: 'boards',
        id: boardId,
        depth: 0,
        overrideAccess: false,
        user,
      })

      // Owners pin the board itself; shared boards keep a per-user hidden list. Another
      // user's private board (only admins can see one) stays untouched.
      if (isOwnedByUser(doc, user.id)) {
        await payload.update({
          collection: 'boards',
          id: boardId,
          data: { pinned },
          overrideAccess: false,
          user,
        })
      } else if (doc.visibleToAllUsers) {
        const prefs = getUserSharedHomePreferences(user)
        const hiddenSharedBoardIds = setHiddenState(
          prefs.hiddenSharedBoardIds,
          boardId,
          pinned !== true,
        )

        await payload.update({
          collection: 'users',
          id: user.id,
          data: {
            hiddenSharedBoardIds,
          },
        })
      }
    } catch (error) {
      console.error('togglePinned failed', error)
      toastKey = 'error'
    }

    redirect(withToast('/koduhaldus', toastKey))
  }

  async function toggleVisibility(formData: FormData) {
    'use server'

    const boardId = formData.get('boardId') as string
    const visibleToAllUsers = formData.get('visibleToAllUsers') === 'true'

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })
    if (!user) redirect('/admin')
    requireActiveMembership(user)

    if (user.role !== 'admin') {
      redirect('/kodu')
    }

    let toastKey: FlashToastKey = visibleToAllUsers ? 'board-shared' : 'board-unshared'
    try {
      await payload.update({
        collection: 'boards',
        id: boardId,
        data: { visibleToAllUsers },
        overrideAccess: true,
      })
    } catch (error) {
      console.error('toggleVisibility failed', error)
      toastKey = 'error'
    }

    redirect(withToast('/koduhaldus', toastKey))
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

    let toastKey: FlashToastKey = 'board-deleted'
    try {
      await payload.delete({ collection: 'boards', id: boardId, overrideAccess: false, user })
    } catch (error) {
      console.error('deleteBoard failed', error)
      toastKey = 'error'
    }

    redirect(withToast('/koduhaldus', toastKey))
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

    let toastKey: FlashToastKey = pinned ? 'game-pinned' : 'game-unpinned'
    try {
      const doc = await payload.findByID({
        collection: 'connect-dots-puzzles',
        id: puzzleId,
        depth: 0,
        overrideAccess: false,
        user,
      })

      if (isOwnedByUser(doc, user.id) || !doc.visibleToAllUsers) {
        await payload.update({
          collection: 'connect-dots-puzzles',
          id: puzzleId,
          data: { pinned },
          overrideAccess: false,
          user,
        })
      } else {
        const prefs = getUserSharedHomePreferences(user)
        const hiddenSharedPuzzleIds = setHiddenState(
          prefs.hiddenSharedPuzzleIds,
          puzzleId,
          pinned !== true,
        )

        await payload.update({
          collection: 'users',
          id: user.id,
          data: {
            hiddenSharedPuzzleIds,
          },
        })
      }
    } catch (error) {
      console.error('togglePuzzlePinned failed', error)
      toastKey = 'error'
    }

    redirect(withToast('/koduhaldus', toastKey))
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

    let toastKey: FlashToastKey = 'game-deleted'
    try {
      await payload.delete({
        collection: 'connect-dots-puzzles',
        id: puzzleId,
        overrideAccess: false,
        user,
      })
    } catch (error) {
      console.error('deletePuzzle failed', error)
      toastKey = 'error'
    }

    redirect(withToast('/koduhaldus', toastKey))
  }

  return (
    <main className="xl:container space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tahvlid</h1>
        <CreateBoardForm createBoard={createBoard} />
      </header>

      <BoardsList
        boards={boards}
        isAdmin={isAdmin}
        toggleVisibility={toggleVisibility}
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
