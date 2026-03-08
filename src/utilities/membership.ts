import { redirect } from 'next/navigation'
import type { User } from '@/payload-types'
import { hasActiveMembership } from '@/utilities/membershipStatus'

export function requireActiveMembership(
  user: Pick<User, 'membershipStatus'> | null | undefined,
  redirectTo = '/profile?membership=required',
) {
  if (!hasActiveMembership(user)) {
    redirect(redirectTo)
  }
}
