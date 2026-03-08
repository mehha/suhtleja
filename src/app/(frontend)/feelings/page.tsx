import { redirect } from 'next/navigation'
import type { User } from '@/payload-types'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { requireActiveMembership } from '@/utilities/membership'
import { FeelingsBoard } from './FeelingsBoard'
import { Heart } from 'lucide-react'

export const dynamic = 'force-dynamic'

type FeelingUser = User & {
  lastFeeling?: string
  lastFeelingAt?: string
}

export default async function FeelingsPage() {
  const { user } = await getCurrentUser()
  if (!user) redirect('/login')
  requireActiveMembership(user)

  const u = user as FeelingUser

  return (
    <main className="container space-y-6 py-6">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <Heart className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Emotsiooniratas</h1>
          <p className="text-sm text-muted-foreground">
            Vali, kuidas sa end tunned. Ütleme lause “Ma tunnen ennast …” ja salvestame selle sinu profiili alla.
          </p>
        </div>
      </header>

      <FeelingsBoard
        lastFeeling={u.lastFeeling ?? undefined}
        lastFeelingAt={u.lastFeelingAt ?? undefined}
      />
    </main>
  )
}
