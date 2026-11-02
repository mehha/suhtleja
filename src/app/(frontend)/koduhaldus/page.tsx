// src/app/(frontend)/koduhaldus/page.tsx
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { BoardsList, type BoardsListBoard } from '../boards/BoardsList'
import { ConnectDotsBoardsList, type ConnectDotsBoardsPuzzle } from '../boards/ConnectDotsBoardsList'
import { CreateBoardForm } from '../boards/CreateBoardForm'
import { Settings2 } from 'lucide-react'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { KODUHALDUS_OTHERS_PARAM, othersPrivateWhere, ownOrSharedWhere } from '@/utilities/koduhaldusQuery'
import { requireParentMode } from '@/utilities/uiMode'
import { requireActiveMembership } from '@/utilities/membership'
import {
  ACTION_ERROR,
  withToast,
  type ActionResult,
  type FlashToastKey,
} from '@/utilities/flashToast'
import {
  getUserSharedHomePreferences,
  isOwnedByUser,
  setHiddenState,
  toIdString,
} from '@/utilities/sharedHomePreferences'

export const dynamic = 'force-dynamic'

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { payload, user } = await getCurrentUser()

  await requireParentMode()

  if (!user) redirect('/admin')
  requireActiveMembership(user)

  const isAdmin = user.role === 'admin'
  const preferences = getUserSharedHomePreferences(user)
  // An admin gets the other users' private boards and games only when they open them.
  const showOthers = isAdmin && (await searchParams)[KODUHALDUS_OTHERS_PARAM] === '1'

  const boardsRes = await payload.find({
    collection: 'boards',
    where: showOthers ? {} : ownOrSharedWhere(user.id),
    sort: 'createdAt',
    depth: 1,
    pagination: false,
    // Only what the list shows. The page goes to the browser, so owners carry their name, email
    // and role, not the whole user (PIN hash, Stripe ids), and boards leave their cells behind.
    select: { name: true, owner: true, pinned: true, visibleToAllUsers: true },
    populate: { users: { email: true, name: true, role: true } },
  })

  const boards: BoardsListBoard[] = boardsRes.docs.map((board) => {
    const isOwnedByCurrentUser = isOwnedByUser(board, user.id)
    const boardId = toIdString(board.id) ?? ''

    return {
      id: board.id,
      name: board.name,
      owner: board.owner,
      visibleToAllUsers: board.visibleToAllUsers,
      homeVisible: isOwnedByCurrentUser
        ? board.pinned === true
        : board.visibleToAllUsers
          ? !preferences.hiddenSharedBoardIds.includes(boardId)
          : board.pinned === true,
      isOwnedByCurrentUser,
    }
  })
  const puzzlesRes = await payload.find({
    collection: 'connect-dots-puzzles',
    depth: 1,
    overrideAccess: false,
    sort: 'updatedAt',
    user,
    pagination: false,
    select: {
      enabled: true,
      owner: true,
      pinned: true,
      title: true,
      updatedAt: true,
      visibleToAllUsers: true,
    },
    populate: { users: { email: true, name: true, role: true } },
    where: showOthers ? {} : ownOrSharedWhere(user.id),
  })

  // How many the admin's "Teiste kasutajate …" would show, with the same access as the lists.
  const others = isAdmin
    ? {
        shown: showOthers,
        boards: (await payload.count({ collection: 'boards', where: othersPrivateWhere(user.id) })).totalDocs,
        puzzles: (
          await payload.count({
            collection: 'connect-dots-puzzles',
            overrideAccess: false,
            user,
            where: othersPrivateWhere(user.id),
          })
        ).totalDocs,
      }
    : null

  const puzzles = puzzlesRes.docs.map((doc) => {
    const puzzle = doc as unknown as ConnectDotsBoardsPuzzle
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

  // The home and sharing switches flip at once and save in the background (ActionSwitch). These
  // actions return their outcome instead of redirecting, and revalidate so the switch settles on
  // the saved value.
  async function togglePinned(formData: FormData): Promise<ActionResult> {
    'use server'

    const boardId = formData.get('boardId') as string
    const pinned = formData.get('pinned') === 'true'

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })
    if (!user) redirect('/admin')
    requireActiveMembership(user)

    try {
      const doc = await payload.findByID({
        collection: 'boards',
        id: boardId,
        depth: 0,
        overrideAccess: false,
        select: { owner: true, visibleToAllUsers: true },
        user,
      })

      // Owners pin the board itself; shared boards keep a per-user hidden list. Another
      // user's private board (only admins can see one) stays untouched.
      if (isOwnedByUser(doc, user.id)) {
        await payload.update({
          collection: 'boards',
          id: boardId,
          data: { pinned },
          depth: 0,
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
          depth: 0,
        })
      } else {
        return { ok: false, error: ACTION_ERROR }
      }
    } catch (error) {
      console.error('togglePinned failed', error)
      return { ok: false, error: ACTION_ERROR }
    }

    revalidatePath('/koduhaldus')
    revalidatePath('/kodu')
    return { ok: true }
  }

  async function toggleVisibility(formData: FormData): Promise<ActionResult> {
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

    try {
      await payload.update({
        collection: 'boards',
        id: boardId,
        data: { visibleToAllUsers },
        depth: 0,
        overrideAccess: true,
      })
    } catch (error) {
      console.error('toggleVisibility failed', error)
      return { ok: false, error: ACTION_ERROR }
    }

    revalidatePath('/koduhaldus')
    revalidatePath('/kodu')
    return { ok: true }
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

  async function togglePuzzlePinned(formData: FormData): Promise<ActionResult> {
    'use server'

    const puzzleId = formData.get('puzzleId') as string
    const pinned = formData.get('pinned') === 'true'

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })
    if (!user) redirect('/admin')
    requireActiveMembership(user)

    try {
      const doc = await payload.findByID({
        collection: 'connect-dots-puzzles',
        id: puzzleId,
        depth: 0,
        overrideAccess: false,
        select: { owner: true, visibleToAllUsers: true },
        user,
      })

      if (isOwnedByUser(doc, user.id) || !doc.visibleToAllUsers) {
        await payload.update({
          collection: 'connect-dots-puzzles',
          id: puzzleId,
          data: { pinned },
          depth: 0,
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
          depth: 0,
        })
      }
    } catch (error) {
      console.error('togglePuzzlePinned failed', error)
      return { ok: false, error: ACTION_ERROR }
    }

    revalidatePath('/koduhaldus')
    revalidatePath('/kodu')
    return { ok: true }
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
    <main className="xl:container space-y-10">
      {/* The page is called as in the menu; its boards and games are sections of the same kind. */}
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Settings2 className="h-6 w-6 text-pink-500" aria-hidden="true" />
        Koduhaldus
      </h1>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Tahvlid</h2>
            <p className="text-sm text-muted-foreground">
              Halda siin tahvleid ja vali, millised neist on lapse koduvaates.
            </p>
          </div>
          <CreateBoardForm createBoard={createBoard} />
        </div>

        <BoardsList
          boards={boards}
          isAdmin={isAdmin}
          others={others ? { count: others.boards, shown: others.shown } : null}
          toggleVisibility={toggleVisibility}
          togglePinned={togglePinned}
          deleteBoard={deleteBoard}
        />
      </section>

      <ConnectDotsBoardsList
        deletePuzzle={deletePuzzle}
        isAdmin={isAdmin}
        others={others ? { count: others.puzzles, shown: others.shown } : null}
        puzzles={puzzles}
        togglePinned={togglePuzzlePinned}
      />
    </main>
  )
}
