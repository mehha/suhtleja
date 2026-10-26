import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

import type { User } from '@/payload-types'
import { ConnectDotsFrontendEditor } from '@/components/ConnectDots/ConnectDotsFrontendEditor'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { parseConnectDotsPuzzleForm } from '@/utilities/connectDotsPuzzleForm'
import { requireActiveMembership } from '@/utilities/membership'
import { requireParentMode } from '@/utilities/uiMode'
import { ACTION_ERROR, withToast, type ActionResult } from '@/utilities/flashToast'

type Params = {
  id: string
}

type PuzzleDoc = {
  description?: null | string
  dots?: unknown
  enabled?: boolean | null
  externalImageURL?: null | string
  id: number | string
  image?: unknown
  owner?: number | string | User | null
  title?: null | string
  visibleToAllUsers?: boolean | null
}

export const dynamic = 'force-dynamic'

export default async function ConnectDotsEditPuzzlePage({
  params,
}: {
  params: Promise<Params>
}) {
  await requireParentMode()

  const { id } = await params
  const { payload, user } = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  requireActiveMembership(user)

  const doc = await payload
    .findByID({
      collection: 'connect-dots-puzzles',
      depth: 1,
      id,
      overrideAccess: false,
      user,
    })
    .catch(() => null)

  if (!doc) {
    notFound()
  }

  const puzzle = doc as unknown as PuzzleDoc
  const ownerId =
    typeof puzzle.owner === 'object' && puzzle.owner !== null ? puzzle.owner.id : puzzle.owner

  if (user.role !== 'admin' && ownerId !== user.id) {
    redirect('/koduhaldus')
  }

  async function updatePuzzle(formData: FormData): Promise<ActionResult> {
    'use server'

    await requireParentMode()

    const { payload, user } = await getCurrentUser()
    if (!user) {
      redirect('/login')
    }
    requireActiveMembership(user)

    // Errors come back to the editor as a toast, so the user's dots stay on the page.
    let parsed: ReturnType<typeof parseConnectDotsPuzzleForm>
    try {
      parsed = parseConnectDotsPuzzleForm(formData, {
        allowGlobalVisibility: user.role === 'admin',
      })
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : ACTION_ERROR }
    }

    try {
      await payload.update({
        collection: 'connect-dots-puzzles',
        data: parsed,
        draft: false,
        id,
        overrideAccess: false,
        user,
      })
    } catch (error) {
      console.error('updatePuzzle failed', error)
      return { ok: false, error: ACTION_ERROR }
    }

    revalidatePath('/connect-dots')
    revalidatePath('/koduhaldus')
    revalidatePath('/kodu')
    revalidatePath(`/connect-dots/manage/${id}`)
    redirect(withToast('/koduhaldus', 'game-saved'))
  }

  return (
    <main className="xl:container space-y-6 py-6">
      <ConnectDotsFrontendEditor
        action={updatePuzzle}
        cancelHref="/koduhaldus"
        canShareGlobally={user.role === 'admin'}
        initialPuzzle={puzzle}
        submitLabel="Salvesta muudatused"
      />
    </main>
  )
}
