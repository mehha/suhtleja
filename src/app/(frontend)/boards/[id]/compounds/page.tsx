// src/app/(frontend)/boards/[id]/compounds/page.tsx
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Board, User } from '@/payload-types'
import { CompoundsEditor } from './CompoundsEditor'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { requireParentMode } from '@/utilities/uiMode'
import { requireActiveMembership } from '@/utilities/membership'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export default async function BoardCompoundsPage({ params }: any) {
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()
  const { id } = await params
  await requireParentMode()

  const { user } = await payload.auth({ headers: requestHeaders })
  if (!user) redirect('/admin')
  requireActiveMembership(user)

  const boardRes = await payload.findByID({
    collection: 'boards',
    id,
    depth: 1,
  })

  const board = boardRes as Board

  const ownerId =
    typeof board.owner === 'object' && board.owner !== null
      ? board.owner.id
      : board.owner

  // omaniku kontroll
  if (ownerId !== user.id) {
    redirect('/koduhaldus')
  }

  const cells =
    board.grid?.cells?.map((cell) => ({
      id: cell.id,
      title: cell.title || cell.id,
    })) ?? []

  async function saveCompounds(boardId: string, compounds: Board['compounds'] | null) {
    'use server'

    const payload = await getPayload({ config: configPromise })
    const requestHeaders = await headers()
    const { user } = await payload.auth({ headers: requestHeaders })
    if (!user) redirect('/admin')
    requireActiveMembership(user)

    const existing = (await payload.findByID({
      collection: 'boards',
      id: boardId,
    })) as Board

    const existingOwnerId =
      typeof existing.owner === 'object' && existing.owner !== null
        ? (existing.owner as User).id
        : existing.owner

    if (existingOwnerId !== user.id) {
      throw new Error('No access')
    }

    if (compounds && compounds.some((c) => (c?.cells?.length ?? 0) < 2)) {
      throw new Error('Iga sõnaühend peab sisaldama vähemalt kahte rida (vähemalt 2 celli).')
    }

    await payload.update({
      collection: 'boards',
      id: boardId,
      data: {
        compounds: compounds ?? [],
      },
    })

    // soovi korral:
    revalidatePath(`/boards/${boardId}/compounds`)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Sõnaühendid · <span className="font-normal">{board.name}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Määra cellide kombinatsioone, mille puhul kuvatekst ja TTS erinevad
            lihtsast summast (nt &quot;kaks&quot; + &quot;kass&quot; → &quot;kaks kassi&quot;).
          </p>
        </div>
        <Link href={`/boards/${board.id}/edit`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />Tagasi seadetesse
          </Button>
        </Link>
      </div>

      <CompoundsEditor
        boardId={String(board.id)}
        initialCompounds={board.compounds}
        cells={cells}
        onSave={saveCompounds}
      />
    </div>
  )
}
