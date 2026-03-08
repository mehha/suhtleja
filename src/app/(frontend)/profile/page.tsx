// src/app/(frontend)/profile/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import type { User } from '@/payload-types'
import { ProfilePageClient } from '@/app/(frontend)/profile/ProfilePageClient'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await getCurrentUser()
  if (!user) redirect('/admin')
  const query = await searchParams

  const u = user as User

  const hasPin = Boolean(u.parentPinHash)
  const membershipRequired = query.membership === 'required'

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Profiil
        </h1>
        <p className="text-sm text-muted-foreground">
          Halda oma kasutaja infot ja vanema PIN-koodi.
        </p>
      </div>

      {membershipRequired && (
        <Alert>
          <AlertTitle>Liikmelisus on vajalik</AlertTitle>
          <AlertDescription>
            Selle funktsiooni kasutamiseks aktiveeri liikmelisus.
          </AlertDescription>
        </Alert>
      )}

      <section className="rounded-2xl border bg-card p-6 space-y-3">
        <h2 className="text-lg font-medium">Kasutaja info</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Nimi</dt>
            <dd>{u.name ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">E-post</dt>
            <dd>{u.email}</dd>
          </div>
        </dl>
      </section>

      <ProfilePageClient
        hasPin={hasPin}
        membershipStatus={u.membershipStatus}
        trialEndsAt={u.trialEndsAt}
        currentPeriodEndsAt={u.currentPeriodEndsAt}
      />
    </div>
  )
}
