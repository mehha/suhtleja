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
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()

  const { user } = await payload.auth({ headers: requestHeaders })

  if (!user) {
    redirect('/login')
  }

  const u = user as User
  requireActiveMembership(u)
  const isParentMode = await isParentModeUtil()
  const preferences = getUserSharedHomePreferences(u)

  const ownedBoardsRes = await payload.find({
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
  })

  const sharedBoardsRes = await payload.find({
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
  })

  const ownedBoards = ownedBoardsRes.docs as Board[]
  const sharedBoards = sortSharedDocs(
    (sharedBoardsRes.docs as Board[]).filter((board) => {
      const boardId = toIdString(board.id)
      return boardId ? !preferences.hiddenSharedBoardIds.includes(boardId) : false
    }),
    preferences.sharedBoardOrder,
  )

  const ownedConnectDotsRes = await payload.find({
    collection: 'connect-dots-puzzles',
    depth: 1,
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
  })

  const sharedConnectDotsRes = await payload.find({
    collection: 'connect-dots-puzzles',
    depth: 1,
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
  })

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

    const createdBoard = await payload.create({
      collection: 'boards',
      data: {
        name,
        owner: user.id,
        grid: { cols: 6, rows: 8, cells: [] },
        pinned: false,
      },
    })

    redirect(`/boards/${createdBoard.id}/edit`)
  }

  async function toggleBoardHomeVisibility(formData: FormData) {
    'use server'

    const boardId = formData.get('boardId') as string | null
    const visible = formData.get('visible') === 'true'

    if (!boardId) {
      redirect('/kodu')
    }

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })

    if (!user) {
      redirect('/admin')
    }
    requireActiveMembership(user)

    const board = (await payload.findByID({
      collection: 'boards',
      id: boardId,
      depth: 0,
    })) as Board

    if (isOwnedByUser(board, user.id)) {
      await payload.update({
        collection: 'boards',
        id: boardId,
        data: {
          pinned: visible,
        },
      })
    } else {
      const prefs = getUserSharedHomePreferences(user)
      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          hiddenSharedBoardIds: setHiddenState(prefs.hiddenSharedBoardIds, boardId, !visible),
        },
      })
    }

    redirect('/kodu')
  }

  async function togglePuzzleHomeVisibility(formData: FormData) {
    'use server'

    const puzzleId = formData.get('puzzleId') as string | null
    const visible = formData.get('visible') === 'true'

    if (!puzzleId) {
      redirect('/kodu')
    }

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })

    if (!user) {
      redirect('/admin')
    }
    requireActiveMembership(user)

    const puzzle = (await payload.findByID({
      collection: 'connect-dots-puzzles',
      id: puzzleId,
      depth: 0,
      overrideAccess: false,
      user,
    })) as SharedHomeConnectDotsPuzzleDoc

    if (isOwnedByUser(puzzle, user.id)) {
      await payload.update({
        collection: 'connect-dots-puzzles',
        id: puzzleId,
        data: {
          pinned: visible,
        },
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
      })
    }

    redirect('/kodu')
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

    const docs = await Promise.all(
      boardIds.map((id) =>
        payload.findByID({
          collection: 'boards',
          id,
          depth: 0,
        }),
      ),
    )

    const ownedBoardIds = docs
      .filter((doc) => isOwnedByUser(doc as Board, user.id))
      .map((doc) => String(doc.id))

    const sharedBoardIds = docs
      .filter((doc) => !isOwnedByUser(doc as Board, user.id) && doc.visibleToAllUsers)
      .map((doc) => String(doc.id))

    await Promise.all(
      ownedBoardIds.map((id, index) =>
        payload.update({
          collection: 'boards',
          id,
          data: {
            order: index + 1,
          },
        }),
      ),
    )

    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        sharedBoardOrder: sharedBoardIds,
      },
    })
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

    const docs = await Promise.all(
      puzzleIds.map((id) =>
        payload.findByID({
          collection: 'connect-dots-puzzles',
          id,
          depth: 0,
          overrideAccess: false,
          user,
        }),
      ),
    )

    const ownedPuzzleIds = docs
      .filter((doc) => isOwnedByUser(doc, user.id))
      .map((doc) => String(doc.id))

    const sharedPuzzleIds = docs
      .filter((doc) => !isOwnedByUser(doc, user.id) && doc.visibleToAllUsers)
      .map((doc) => String(doc.id))

    await Promise.all(
      ownedPuzzleIds.map((id, index) =>
        payload.update({
          collection: 'connect-dots-puzzles',
          id,
          data: {
            order: index + 1,
          },
          overrideAccess: false,
          user,
        }),
      ),
    )

    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        sharedPuzzleOrder: sharedPuzzleIds,
      },
    })
  }

  const hasBoards = ownedBoards.length > 0 || sharedBoards.length > 0
  const hasPuzzles = ownedPuzzles.length > 0 || sharedPuzzles.length > 0

  return (
    <main className="xl:p-6 space-y-10">
      <header className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <MonitorCheck className="h-6 w-6 text-pink-500" />
          <h1 className="text-2xl font-semibold">Kodu</h1>
        </div>
        {isParentMode && (
          <div className="flex flex-wrap items-center gap-2">
            <CreateBoardForm createBoard={createBoard} />
            <Button className="gap-2" asChild>
              <Link href="/connect-dots/manage/new">
                <PlusCircle className="h-4 w-4" />
                Lisa uus puzzle
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/koduhaldus" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Halda koduhaldust <ArrowRight className={`w-4 h-4`} />
              </Link>
            </Button>
          </div>
        )}
      </header>

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
                <h2 className="text-lg font-semibold">Connect-dots puzzle&apos;id</h2>
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
  )
}
