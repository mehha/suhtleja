import { redirect } from 'next/navigation'
import { RegisterForm } from '@/components/Auth/register-form'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  description: 'Loo Suhtleja konto, et alustada eestikeelsete AAC tööriistade kasutamist.',
  robots: {
    follow: false,
    index: false,
  },
  title: 'Loo konto',
}

export default async function RegisterPage() {
  // Homepage buttons link here, so logged-in users go straight to their home view.
  const { user } = await getCurrentUser()
  if (user) redirect('/kodu')

  return (
    <div className="flex w-full items-center justify-center">
      <div className="w-full max-w-sm">
        <RegisterForm />
      </div>
    </div>
  )
}
