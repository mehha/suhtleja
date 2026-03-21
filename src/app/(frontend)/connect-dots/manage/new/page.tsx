import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ConnectDotsFrontendEditor } from '@/components/ConnectDots/ConnectDotsFrontendEditor'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { parseConnectDotsPuzzleForm } from '@/utilities/connectDotsPuzzleForm'
import { requireActiveMembership } from '@/utilities/membership'
import { requireParentMode } from '@/utilities/uiMode'

export const dynamic = 'force-dynamic'

export default async function ConnectDotsNewPuzzlePage() {
  await requireParentMode()

  const { user } = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  requireActiveMembership(user)

  const canShareGlobally = user.role === 'admin'

  async function createPuzzle(formData: FormData) {
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

    await payload.create({
      collection: 'connect-dots-puzzles',
      data: {
        ...parsed,
        owner: user.id,
      },
      draft: false,
      overrideAccess: false,
      user,
    })

    revalidatePath('/connect-dots')
    revalidatePath('/tegevused')
    revalidatePath('/home')
    redirect('/tegevused')
  }

  return (
    <main className="container space-y-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Lisa uus connect-dots puzzle</h1>
          <p className="text-sm text-muted-foreground">
            Puzzle luuakse sinu kontole. Admin saab soovi korral teha selle hiljem kõigile nähtavaks.
          </p>
        </div>

        <Button asChild type="button" variant="outline">
          <Link href="/tegevused">Tagasi nimekirja</Link>
        </Button>
      </div>

      <ConnectDotsFrontendEditor
        action={createPuzzle}
        cancelHref="/tegevused"
        canShareGlobally={canShareGlobally}
        submitLabel="Salvesta puzzle"
      />
    </main>
  )
}
