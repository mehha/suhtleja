import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import type { Board, User } from '@/payload-types'
import { SortableConnectDotsPuzzles, type HomeConnectDotsPuzzle } from './SortableConnectDotsPuzzles'
import { SortableBoards, type HomeBoard } from './SortableBoards'
import { ArrowRight, MonitorCheck, PlusCircle, Settings2 } from 'lucide-react'
import { isParentModeUtil, requireParentMode } from '@/utilities/uiMode'
import { requireActiveMembership } from '@/utilities/membership'
import { revalidatePath } from 'next/cache'
import { ACTION_ERROR, withToast, type ActionResult } from '@/utilities/flashToast'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CreateBoardForm } from '../boards/CreateBoardForm'
import { serializeConnectDotsPuzzle } from '@/utilities/connectDots'
import {
  getUserSharedHomePreferences,
  isOwnedByUser,
  setHiddenState,
  sortSharedDocs,
  toIdString,
} from '@/utilities/sharedHomePreferences'
import { ChildModeBar } from './ChildModeBar'
import { getCurrentUser } from '@/utilities/getCurrentUser'

// What a home card shows: the name and the first card's picture. The boards go to the browser, so
// they leave out the owner (populated, a whole user document), the other cards and the speech cache.
const HOME_BOARD_SELECT = {
  grid: { cells: { externalImageURL: true, image: true } },
  name: true,
  order: true,
} as const

export const dynamic = 'force-dynamic'

type SharedHomeConnectDotsPuzzleDoc = {
  description?: null | string
  dots?: unknown
  enabled?: boolean | null
  externalImageURL?: null | string
  id: number | string
  image?: unknown
  order?: number | null
  owner?: number | string | User | null
  title?: null | string
}

export default async function HomePage() {
  const { payload, user } = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const u = user as User
  requireActiveMembership(u)
  const isParentMode = await isParentModeUtil()
  const preferences = getUserSharedHomePreferences(u)

  // The four lists don't depend on each other. pagination: false, or Payload stops at 10.
  const [ownedBoardsRes, sharedBoardsRes, ownedConnectDotsRes, sharedConnectDotsRes] =
    await Promise.all([
      payload.find({
        collection: 'boards',
        where: {
          and: [
            {
              owner: {
                equals: u.id,
              },
            },
            {
              pinned: {
                equals: true,
              },
            },
          ],
        },
        sort: 'order',
        depth: 1,
        pagination: false,
        select: HOME_BOARD_SELECT,
      }),
      payload.find({
        collection: 'boards',
        where: {
          and: [
            {
              visibleToAllUsers: {
                equals: true,
              },
            },
            {
              owner: {
                not_equals: u.id,
              },
            },
          ],
        },
        sort: 'order',
        depth: 1,
        pagination: false,
        select: HOME_BOARD_SELECT,
      }),
      payload.find({
        collection: 'connect-dots-puzzles',
        depth: 1,
        pagination: false,
        sort: 'order',
        overrideAccess: false,
        user,
        where: {
          and: [
            {
              owner: {
                equals: u.id,
              },
            },
            {
              enabled: {
                equals: true,
              },
            },
            {
              pinned: {
                equals: true,
              },
            },
          ],
        },
      }),
      payload.find({
        collection: 'connect-dots-puzzles',
        depth: 1,
        pagination: false,
        sort: 'order',
        overrideAccess: false,
        user,
        where: {
          and: [
            {
              enabled: {
                equals: true,
              },
            },
            {
              visibleToAllUsers: {
                equals: true,
              },
            },
            {
              owner: {
                not_equals: u.id,
              },
            },
          ],
        },
      }),
    ])

  const ownedBoards = ownedBoardsRes.docs as Board[]
  const sharedBoards = sortSharedDocs(
    (sharedBoardsRes.docs as Board[]).filter((board) => {
      const boardId = toIdString(board.id)
      return boardId ? !preferences.hiddenSharedBoardIds.includes(boardId) : false
    }),
    preferences.sharedBoardOrder,
  )

  const ownedPuzzles = ownedConnectDotsRes.docs
    .map((doc) => serializeConnectDotsPuzzle(doc as unknown as Record<string, unknown>))
    .filter((puzzle): puzzle is HomeConnectDotsPuzzle => puzzle !== null)

  const sharedPuzzleDocs = sortSharedDocs(
    (sharedConnectDotsRes.docs as SharedHomeConnectDotsPuzzleDoc[]).filter((doc) => {
      const puzzleId = toIdString(doc.id)
      return puzzleId ? !preferences.hiddenSharedPuzzleIds.includes(puzzleId) : false
    }),
    preferences.sharedPuzzleOrder,
  )

  const sharedPuzzles = sharedPuzzleDocs
    .map((doc) => serializeConnectDotsPuzzle(doc as unknown as Record<string, unknown>))
    .filter((puzzle): puzzle is HomeConnectDotsPuzzle => puzzle !== null)

  const boardCards: HomeBoard[] = [
    ...ownedBoards.map((board) => ({
      ...board,
      canEdit: isParentMode,
      isShared: false,
      unpinLabel: 'Eemalda koduvaatest',
    })),
    ...sharedBoards.map((board) => ({
      ...board,
      canEdit: false,
      isShared: true,
      unpinLabel: 'Peida enda koduvaatest',
    })),
  ]

  const puzzleCards: HomeConnectDotsPuzzle[] = [
    ...ownedPuzzles.map((puzzle) => ({
      ...puzzle,
      canEdit: isParentMode,
      isShared: false,
      unpinLabel: 'Eemalda koduvaatest',
    })),
    ...sharedPuzzles.map((puzzle) => ({
      ...puzzle,
      canEdit: false,
      isShared: true,
      unpinLabel: 'Peida enda koduvaatest',
    })),
  ]

  async function createBoard(formData: FormData) {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })

    await requireParentMode()

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
          pinned: false,
        },
      })
      createdBoardId = createdBoard.id
    } catch (error) {
      console.error('createBoard failed', error)
    }

    redirect(
      createdBoardId === null
        ? withToast('/kodu', 'error')
        : withToast(`/boards/${createdBoardId}/edit`, 'board-created'),
    )
  }

  // Removing a card from the home hides it at once (SortableBoards, SortableConnectDotsPuzzles) and
  // saves in the background. These actions return their outcome instead of redirecting, and
  // revalidate so the list settles on the saved one.
  async function toggleBoardHomeVisibility(formData: FormData): Promise<ActionResult> {
    'use server'

    const boardId = formData.get('boardId') as string | null
    const visible = formData.get('visible') === 'true'

    if (!boardId) {
      return { ok: false, error: ACTION_ERROR }
    }

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })

    if (!user) {
      redirect('/admin')
    }
    requireActiveMembership(user)

    try {
      const board = await payload.findByID({
        collection: 'boards',
        id: boardId,
        depth: 0,
        select: { owner: true },
      })

      if (isOwnedByUser(board, user.id)) {
        await payload.update({
          collection: 'boards',
          id: boardId,
          data: {
            pinned: visible,
          },
          depth: 0,
        })
      } else {
        const prefs = getUserSharedHomePreferences(user)
        await payload.update({
          collection: 'users',
          id: user.id,
          data: {
            hiddenSharedBoardIds: setHiddenState(prefs.hiddenSharedBoardIds, boardId, !visible),
          },
          depth: 0,
        })
      }
    } catch (error) {
      console.error('toggleBoardHomeVisibility failed', error)
      return { ok: false, error: ACTION_ERROR }
    }

    revalidatePath('/kodu')
    revalidatePath('/koduhaldus')
    return { ok: true }
  }

  async function togglePuzzleHomeVisibility(formData: FormData): Promise<ActionResult> {
    'use server'

    const puzzleId = formData.get('puzzleId') as string | null
    const visible = formData.get('visible') === 'true'

    if (!puzzleId) {
      return { ok: false, error: ACTION_ERROR }
    }

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })

    if (!user) {
      redirect('/admin')
    }
    requireActiveMembership(user)

    try {
      const puzzle = await payload.findByID({
        collection: 'connect-dots-puzzles',
        id: puzzleId,
        depth: 0,
        overrideAccess: false,
        select: { owner: true },
        user,
      })

      if (isOwnedByUser(puzzle, user.id)) {
        await payload.update({
          collection: 'connect-dots-puzzles',
          id: puzzleId,
          data: {
            pinned: visible,
          },
          depth: 0,
          overrideAccess: false,
          user,
        })
      } else {
        const prefs = getUserSharedHomePreferences(user)
        await payload.update({
          collection: 'users',
          id: user.id,
          data: {
            hiddenSharedPuzzleIds: setHiddenState(prefs.hiddenSharedPuzzleIds, puzzleId, !visible),
          },
          depth: 0,
        })
      }
    } catch (error) {
      console.error('togglePuzzleHomeVisibility failed', error)
      return { ok: false, error: ACTION_ERROR }
    }

    revalidatePath('/kodu')
    revalidatePath('/koduhaldus')
    return { ok: true }
  }

  async function reorderMixedBoards(boardIds: string[]) {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })

    if (!user) {
      redirect('/admin')
    }
    requireActiveMembership(user)

    // One query for the owners, in the order the parent left the cards. The updates only change
    // the order, so they return nothing populated (by default each was a whole board with media).
    const found = await payload.find({
      collection: 'boards',
      depth: 0,
      pagination: false,
      select: { owner: true, visibleToAllUsers: true },
      where: { id: { in: boardIds } },
    })
    const docsById = new Map(found.docs.map((doc) => [String(doc.id), doc]))
    const docs = boardIds.flatMap((id) => docsById.get(id) ?? [])

    const ownedBoardIds = docs
      .filter((doc) => isOwnedByUser(doc, user.id))
      .map((doc) => String(doc.id))

    const sharedBoardIds = docs
      .filter((doc) => !isOwnedByUser(doc, user.id) && doc.visibleToAllUsers)
      .map((doc) => String(doc.id))

    await Promise.all([
      ...ownedBoardIds.map((id, index) =>
        payload.update({
          collection: 'boards',
          id,
          data: {
            order: index + 1,
          },
          depth: 0,
        }),
      ),
      payload.update({
        collection: 'users',
        id: user.id,
        data: {
          sharedBoardOrder: sharedBoardIds,
        },
        depth: 0,
      }),
    ])
  }

  async function reorderMixedPuzzles(puzzleIds: string[]) {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })

    if (!user) {
      redirect('/admin')
    }
    requireActiveMembership(user)

    const found = await payload.find({
      collection: 'connect-dots-puzzles',
      depth: 0,
      overrideAccess: false,
      pagination: false,
      select: { owner: true, visibleToAllUsers: true },
      user,
      where: { id: { in: puzzleIds } },
    })
    const docsById = new Map(found.docs.map((doc) => [String(doc.id), doc]))
    const docs = puzzleIds.flatMap((id) => docsById.get(id) ?? [])

    const ownedPuzzleIds = docs
      .filter((doc) => isOwnedByUser(doc, user.id))
      .map((doc) => String(doc.id))

    const sharedPuzzleIds = docs
      .filter((doc) => !isOwnedByUser(doc, user.id) && doc.visibleToAllUsers)
      .map((doc) => String(doc.id))

    await Promise.all([
      ...ownedPuzzleIds.map((id, index) =>
        payload.update({
          collection: 'connect-dots-puzzles',
          id,
          data: {
            order: index + 1,
          },
          depth: 0,
          overrideAccess: false,
          user,
        }),
      ),
      payload.update({
        collection: 'users',
        id: user.id,
        data: {
          sharedPuzzleOrder: sharedPuzzleIds,
        },
        depth: 0,
      }),
    ])
  }

  const hasBoards = ownedBoards.length > 0 || sharedBoards.length > 0
  const hasPuzzles = ownedPuzzles.length > 0 || sharedPuzzles.length > 0

  return (
    <>
      {/* The child view gets the child's bar, with the Kodu button marked as the current page. */}
      {!isParentMode && <ChildModeBar current hasPin={Boolean(u.parentPinHash)} />}
      <main className="xl:p-6 space-y-10">
        {isParentMode && (
          <header className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <MonitorCheck className="h-6 w-6 text-pink-500" />
              <h1 className="text-2xl font-semibold">Kodu</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CreateBoardForm createBoard={createBoard} />
              <Button className="gap-2" asChild>
                <Link href="/connect-dots/manage/new">
                  <PlusCircle className="h-4 w-4" />
                  Lisa mäng
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/koduhaldus" className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Koduhaldus <ArrowRight className={`w-4 h-4`} />
                </Link>
              </Button>
            </div>
          </header>
        )}

        {!hasBoards && !hasPuzzles ? (
          <>
            <p className="text-muted-foreground">Sul pole veel midagi lisatud kodu vaatesse.</p>
            {!isParentMode && (
              <p className="text-muted-foreground">Lisamiseks lülituse vanema vaatesse</p>
            )}
          </>
        ) : (
          <div className="space-y-10">
            {hasBoards ? (
              <section className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Tahvlid</h2>
                </div>

                <SortableBoards
                  boards={boardCards}
                  canManage={isParentMode}
                  isAdmin={u.role === 'admin'}
                  onReorder={reorderMixedBoards}
                  unpinAction={toggleBoardHomeVisibility}
                />
              </section>
            ) : null}

            {hasPuzzles ? (
              <section className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Mängud</h2>
                </div>

                <SortableConnectDotsPuzzles
                  canManage={isParentMode}
                  isAdmin={u.role === 'admin'}
                  onReorder={reorderMixedPuzzles}
                  puzzles={puzzleCards}
                  unpinAction={togglePuzzleHomeVisibility}
                />
              </section>
            ) : null}
          </div>
        )}
      </main>
    </>
  )
}
