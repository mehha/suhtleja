// src/app/(frontend)/profile/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { MEMBERSHIP_TRIAL_DAYS } from '@/utilities/membershipCheckout'
import type { User } from '@/payload-types'
import { ProfilePageClient } from '@/app/(frontend)/profile/ProfilePageClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await getCurrentUser()
  if (!user) redirect('/admin')
  const query = await searchParams

  const u = user as User

  const hasPin = Boolean(u.parentPinHash)
  const membershipRequired = query.membership === 'required'
  const isTrialEligible = !u.membershipStatus || u.membershipStatus === 'none'

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Profiil</h1>
        <p className="text-sm text-muted-foreground">
          Halda oma kasutaja infot ja vanema PIN-koodi.
        </p>
      </div>

      {membershipRequired && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">
              {isTrialEligible ? 'Alusta tasuta prooviperioodi' : 'Liikmelisus on vajalik'}
            </CardTitle>
            <CardDescription>
              {isTrialEligible
                ? `Suhtleja kasutamiseks käivita ${MEMBERSHIP_TRIAL_DAYS}-päevane tasuta prooviperiood. Makseviisi pole vaja lisada.`
                : 'Selle funktsiooni kasutamiseks aktiveeri liikmelisus.'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Kasutaja info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Nimi</dt>
              <dd>{u.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">E-post</dt>
              <dd>{u.email}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <ProfilePageClient
        hasPin={hasPin}
        membershipStatus={u.membershipStatus}
        trialEndsAt={u.trialEndsAt}
        currentPeriodEndsAt={u.currentPeriodEndsAt}
        membershipCancelAtPeriodEnd={u.membershipCancelAtPeriodEnd}
      />
    </div>
  )
}
