import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

import type { User } from '@/payload-types'
import { ConnectDotsFrontendEditor } from '@/components/ConnectDots/ConnectDotsFrontendEditor'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { parseConnectDotsPuzzleForm } from '@/utilities/connectDotsPuzzleForm'
import { requireActiveMembership } from '@/utilities/membership'
import { requireParentMode } from '@/utilities/uiMode'

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
    redirect('/tegevused')
  }

  async function updatePuzzle(formData: FormData) {
    'use server'

    await requireParentMode()

    const { payload, user } = await getCurrentUser()
    if (!user) {
      redirect('/login')
    }
    requireActiveMembership(user)

    const parsed = parseConnectDotsPuzzleForm(formData, {
      allowGlobalVisibility: user.role === 'admin',
    })

    await payload.update({
      collection: 'connect-dots-puzzles',
      data: parsed,
      draft: false,
      id,
      overrideAccess: false,
      user,
    })

    revalidatePath('/connect-dots')
    revalidatePath('/tegevused')
    revalidatePath('/home')
    revalidatePath(`/connect-dots/manage/${id}`)
    redirect('/tegevused')
  }

  return (
    <main className="container space-y-6 py-6">
      <ConnectDotsFrontendEditor
        action={updatePuzzle}
        cancelHref="/tegevused"
        canShareGlobally={user.role === 'admin'}
        initialPuzzle={puzzle}
        submitLabel="Salvesta muudatused"
      />
    </main>
  )
}
