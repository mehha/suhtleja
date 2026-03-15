import type { User } from '@/payload-types'

export type MembershipStatus = User['membershipStatus']

export const ACTIVE_MEMBERSHIP_STATUSES: Array<NonNullable<MembershipStatus>> = ['trialing', 'active']
export const MEMBERSHIP_BYPASS_EMAILS = new Set(['info@mehh.ee', 'pilleriin.pukspuu@gmail.com'])

export function hasMembershipBypassEmail(
  user: Pick<User, 'email'> | null | undefined,
): boolean {
  if (!user?.email) return false

  return MEMBERSHIP_BYPASS_EMAILS.has(user.email.trim().toLowerCase())
}

export function hasActiveMembership(
  user: Pick<User, 'email' | 'membershipStatus' | 'role'> | null | undefined,
): boolean {
  if (!user) return false
  if (process.env.NODE_ENV !== 'production' && user.role === 'admin') {
    return true
  }
  if (hasMembershipBypassEmail(user)) {
    return true
  }

  return ACTIVE_MEMBERSHIP_STATUSES.includes(user.membershipStatus ?? 'none')
}
