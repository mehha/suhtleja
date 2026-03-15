import { redirect } from 'next/navigation'
import type { User } from '@/payload-types'
import { hasActiveMembership } from '@/utilities/membershipStatus'

export function requireActiveMembership(
  user: Pick<User, 'email' | 'membershipStatus' | 'role'> | null | undefined,
  redirectTo = '/profile?membership=required',
) {
  if (!hctiveMembership(user)) {
    redirect(redirectTo)
  }
}
