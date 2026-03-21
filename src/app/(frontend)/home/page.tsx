import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import type { Board, User } from '@/payload-types'
import { SortableConnectDotsPuzzles, type HomeConnectDotsPuzzle } from './SortableConnectDotsPuzzles'
import { SortableBoards } from './SortableBoards'
import { reorderBoards } from './reorderBoards'
import { reorderConnectDotsPuzzles } from './reorderConnectDotsPuzzles'
import { ArrowRight, MonitorCheck } from 'lucide-react'
import { isParentModeUtil, requireParentMode } from '@/utilities/uiMode'
import { requireActiveMembership } from '@/utilities/membership'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CreateBoardForm } from '../boards/CreateBoardForm'
import { serializeConnectDotsPuzzle } from '@/utilities/connectDots'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()

  const { user } = await payload.auth({ headers: requestHeaders })

  if (!user) {
    redirect('/login')
  }

  const isParentMode = await isParentModeUtil()
  const u = user as User

  const boardsRes = await payload.find({
    collection: 'boards',
    where: u.role === 'admin'
      ? {
          pinned: {
            equals: true,
          },
        }
      : {
          and: [
            {
              pinned: {
                equals: true,
              },
            },
            {
              or: [
                {
                  owner: {
                    equals: u.id,
                  },
                },
                {
                  visibleToAllUsers: {
                    equals: true,
                  },
                },
              ],
            },
          ],
        },
    sort: 'order',
    depth: 1,
  })

  const boards = boardsRes.docs as Board[]
  const connectDotsRes = await payload.find({
    collection: 'connect-dots-puzzles',
    depth: 1,
    sort: 'order',
    overrideAccess: false,
    user,
    where:
      u.role === 'admin'
        ? {
            and: [
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
          }
        : {
            and: [
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
              {
                or: [
                  {
                    owner: {
                      equals: u.id,
                    },
                  },
                  {
                    visibleToAllUsers: {
                      equals: true,
                    },
                  },
                ],
              },
            ],
          },
  })

  const puzzles = connectDotsRes.docs
    .map((doc) => serializeConnectDotsPuzzle(doc as unknown as Record<string, unknown>))
    .filter((puzzle): puzzle is HomeConnectDotsPuzzle => puzzle !== null)

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

    await payload.create({
      collection: 'boards',
      data: {
        name,
        owner: user.id,
        grid: { cols: 6, rows: 8, cells: [] },
        pinned: false,
      },
    })

    redirect('/boards')
  }

  return (
    <main className="p-6 space-y-10">
      <header className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <MonitorCheck className="h-6 w-6 text-pink-500" />
          <h1 className="text-2xl font-semibold">Kodu</h1>
        </div>
        {isParentMode && (
          <div className="flex items-center gap-2">
            <CreateBoardForm createBoard={createBoard} />
            <Button variant="outline" asChild>
              <Link href="/boards" className="flex items-center gap-2">
                Halda tahvleid <ArrowRight className={`w-4 h-4`} />
              </Link>
            </Button>
          </div>
        )}
      </header>

      {boards.length === 0 && puzzles.length === 0 ? (
        <>
          <p className="text-muted-foreground">Sul pole veel midagi lisatud kodu vaatesse.</p>
          {!isParentMode && (
            <p className="text-muted-foreground">Lisamiseks lülituse vanema vaatesse</p>
          )}
        </>
      ) : (
        <div className="space-y-10">
          {boards.length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Tahvlid</h2>
              </div>
              <SortableBoards
                boards={boards}
                canManage={isParentMode}
                currentUserId={u.id}
                isAdmin={u.role === 'admin'}
                onReorder={reorderBoards}
                unpinAction={async (formData: FormData) => {
                  'use server'

                  const boardId = formData.get('boardId') as string | null
                  if (!boardId) {
                    redirect('/home')
                  }

                  const payload = await getPayload({ config: configPromise })
                  const requestHeaders = await headers()
                  const { user } = await payload.auth({ headers: requestHeaders })

                  if (!user) {
                    redirect('/admin')
                  }

                  await payload.update({
                    collection: 'boards',
                    id: boardId,
                    data: {
                      pinned: false,
                    },
                  })

                  redirect('/home')
                }}
              />
            </section>
          ) : null}

          {puzzles.length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Connect-dots puzzle&apos;id</h2>
              </div>
              <SortableConnectDotsPuzzles
                canManage={isParentMode}
                isAdmin={u.role === 'admin'}
                onReorder={reorderConnectDotsPuzzles}
                puzzles={puzzles}
                unpinAction={async (formData: FormData) => {
                  'use server'

                  const puzzleId = formData.get('puzzleId') as string | null
                  if (!puzzleId) {
                    redirect('/home')
                  }

                  const payload = await getPayload({ config: configPromise })
                  const requestHeaders = await headers()
                  const { user } = await payload.auth({ headers: requestHeaders })

                  if (!user) {
                    redirect('/admin')
                  }

                  await payload.update({
                    collection: 'connect-dots-puzzles',
                    id: puzzleId,
                    data: {
                      pinned: false,
                    },
                    overrideAccess: false,
                    user,
                  })

                  redirect('/home')
                }}
              />
            </section>
          ) : null}
        </div>
      )}
    </main>
  )
}
