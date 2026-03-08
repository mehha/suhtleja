import type { AccessArgs, Where } from 'payload'
import type { User } from '@/payload-types'
import { hasActiveMembership } from '@/utilities/membershipStatus'

/**
 * For collections where docs have `owner` (relationship to users)
 * and you want to allow only the owner to read/update.
 * Returns a where object for Payload if user is not admin.
 */
export const isAdminOrOwner = ({ req }: AccessArgs<User>): boolean | Where => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  if (!hasActiveMembership(req.user)) return false
  return {
    owner: {
      equals: req.user.id,
    },
  }
}
