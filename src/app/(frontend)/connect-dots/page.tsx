import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { requireActiveMembership } from '@/utilities/membership'
import { ConnectDotsPlayground } from './ConnectDotsPlayground'
import { PUZZLES } from './puzzles'
import { PencilRuler } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ConnectDotsPage() {
  const { user } = await getCurrentUser()
  if (!user) redirect('/login')
  requireActiveMembership(user)

  return (
    <main className="container space-y-6 py-6">
      <header className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <PencilRuler className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold leading-tight">Ühenda punktid</h1>
          <p className="text-sm text-muted-foreground">
            Puutetundlik “connect the dots” kass. Toksides õigel järjekorral (1 → 12) joonistame liinid ise.
          </p>
          <p className="text-xs text-muted-foreground">
            Nipp: kui vajutad valel numbril, ei juhtu midagi — proovi järgmist. Saad “Samm tagasi” või “Alusta uuesti”.
          </p>
        </div>
      </header>

      <ConnectDotsPlayground puzzles={PUZZLES} />
    </main>
  )
}
