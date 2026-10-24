import type { AccessArgs, Where } from 'payload'
import type { User } from '@/payload-types'

/**
 * For the users collection: admins can access every user, everyone else only
 * their own account. Returns a where query so list requests are filtered too.
 */
export const isAdminOrSelf = ({ req }: AccessArgs<User>): boolean | Where => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  return {
    id: {
      equals: req.user.id,
    },
  }
}
