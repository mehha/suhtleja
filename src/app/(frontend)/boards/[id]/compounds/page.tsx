import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ArrowLeft, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Board, Media } from '@/payload-types'
import { ACTION_ERROR, type ActionResult } from '@/utilities/flashToast'
import { findBoardForUser, getBoardOwnerId } from '@/utilities/findBoardForUser'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { requireActiveMembership } from '@/utilities/membership'
import { requireParentMode } from '@/utilities/uiMode'
import { CompoundsEditor, type BoardCard } from './CompoundsEditor'
import { findCompoundsProblem } from './validateCompounds'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{ id: string }>
}

export default async function BoardCompoundsPage({ params }: Args) {
  const { id } = await params
  await requireParentMode()

  const { payload, user } = await getCurrentUser()
  if (!user) redirect('/admin')
  requireActiveMembership(user)

  const board = await findBoardForUser(payload, user, id)
  if (!board) notFound()

  // Compounds are the owner's: an admin or a shared board's viewer can't change them.
  if (getBoardOwnerId(board) !== user.id) {
    redirect('/koduhaldus')
  }

  // The board's cards row by row, the order the child sees them in.
  const cards: BoardCard[] = [...(board.grid?.cells ?? [])]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((cell) => ({
      id: cell.id,
      title: cell.title?.trim() ?? '',
      imageURL:
        cell.externalImageURL ||
        (typeof cell.image === 'object' && cell.image ? (cell.image as Media).url : null) ||
        null,
    }))

  // Returns the outcome instead of throwing: a thrown error's message doesn't reach the client in
  // production, so the editor could only say that saving failed.
  async function saveCompounds(
    boardId: string,
    compounds: Board['compounds'] | null,
  ): Promise<ActionResult> {
    'use server'

    const { payload, user } = await getCurrentUser()
    if (!user) redirect('/admin')
    requireActiveMembership(user)

    const problem = findCompoundsProblem(compounds ?? [])
    if (problem) return { ok: false, error: problem }

    // The collection's update access lets only the owner change the board.
    try {
      await payload.update({
        collection: 'boards',
        id: boardId,
        data: { compounds: compounds ?? [] },
        overrideAccess: false,
        user,
      })
    } catch (error) {
      console.error('saveCompounds failed', error)
      return { ok: false, error: ACTION_ERROR }
    }

    revalidatePath(`/boards/${boardId}/compounds`)
    revalidatePath(`/boards/${boardId}`)
    return { ok: true }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-8 pt-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{board.name}</p>
          <h1 className="text-3xl font-semibold">Sõnaühendid</h1>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/boards/${board.id}/edit`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Muuda tahvlit
            </Link>
          </Button>
          <Button asChild variant="positive" size="sm" className="gap-2">
            <Link href={`/boards/${board.id}`}>
              <Play className="h-4 w-4" aria-hidden="true" />
              Vaata tahvlit
            </Link>
          </Button>
        </div>
      </header>

      <p className="mb-6 max-w-2xl text-slate-600">
        Kui laps vajutab need kaardid järjest, näidatakse ja öeldakse sõnu nii, nagu siia kirjutad.
        Näiteks <strong className="font-semibold text-slate-900">kaks</strong> +{' '}
        <strong className="font-semibold text-slate-900">kass</strong> → „kaks kassi“.
      </p>

      <CompoundsEditor
        boardId={String(board.id)}
        initialCompounds={board.compounds}
        cards={cards}
        aiEnabled={board.extra?.ai ?? false}
        onSave={saveCompounds}
      />
    </div>
  )
}
