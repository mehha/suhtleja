import type { User } from '@/payload-types'

export type MembershipStatus = User['membershipStatus']

export const ACTIVE_MEMBERSHIP_STATUSES: Array<NonNullable<MembershipStatus>> = ['trialing', 'active']

export function hasActiveMembership(user: Pick<User, 'membershipStatus'> | null | undefined): boolean {
  if (!user) return false
  return ACTIVE_MEMBERSHIP_STATUSES.includes(user.membershipStatus ?? 'none')
}

