import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { requireActiveMembership } from '@/utilities/membership'
import { Button } from '@/components/ui/button'
import { PencilRuler } from 'lucide-react'
import { ConnectDotsGame } from '@/components/ConnectDots/ConnectDotsGame'
import {
  type ConnectDotsPuzzle as ConnectDotsPlayerPuzzle,
  serializeConnectDotsPuzzle,
} from '@/utilities/connectDots'
import { isParentModeUtil } from '@/utilities/uiMode'

export const dynamic = 'force-dynamic'

export default async function ConnectDotsPage({
  searchParams,
}: {
  searchParams?: Promise<{ puzzle?: string }>
}) {
  const { payload, user } = await getCurrentUser()
  if (!user) redirect('/login')
  requireActiveMembership(user)
  const isParentMode = await isParentModeUtil()
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const initialPuzzleId =
    typeof resolvedSearchParams?.puzzle === 'string' ? resolvedSearchParams.puzzle : undefined

  const puzzlesResult = await payload.find({
    collection: 'connect-dots-puzzles',
    depth: 1,
    sort: 'order',
    overrideAccess: false,
    user,
    where:
      user.role === 'admin'
        ? {
            enabled: {
              equals: true,
            },
          }
        : {
            and: [
              {
                enabled: {
                  equals: true,
                },
              },
              {
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
            ],
          },
  })

  const puzzles = puzzlesResult.docs
    .map((doc) => serializeConnectDotsPuzzle(doc as unknown as Record<string, unknown>))
    .filter((puzzle): puzzle is ConnectDotsPlayerPuzzle => puzzle !== null)

  return (
    <main className="container space-y-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <PencilRuler className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold leading-tight">Ühenda punktid</h1>
            <p className="text-sm text-muted-foreground">
              Vali pilt, ühenda punktid õiges järjekorras ja lase peidetud kujundil samm-sammult välja ilmuda.
            </p>
            <p className="text-xs text-muted-foreground">
              Saad mängida klõpsates või pliiatsi moodi joont vedades. Loendus töötab nii 1 kaupa, 4 kaupa kui
              ka ABC järjestuses.
            </p>
          </div>
        </div>

        {isParentMode ? (
          <Button asChild type="button" variant="outline">
            <Link href="/koduhaldus">Halda puzzle&apos;eid</Link>
          </Button>
        ) : null}
      </header>

      {puzzles.length > 0 ? (
        <ConnectDotsGame initialPuzzleId={initialPuzzleId} puzzles={puzzles} revealMode="complete" />
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-600">
          {isParentMode
            ? 'Ühtegi aktiivset connect-dots pilti pole veel seadistatud. Ava tahvlite vaade ja lisa esimene puzzle.'
            : 'Ühtegi aktiivset connect-dots pilti pole veel seadistatud.'}
        </div>
      )}
    </main>
  )
}
