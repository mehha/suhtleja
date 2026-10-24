import type { AccessArgs, Where } from 'payload'
import type { User } from '@/payload-types'

/**
 * Admins can read drafts; everyone else, including logged-in customers,
 * only sees published documents.
 */
export const isAdminOrPublished = ({ req }: AccessArgs<User>): boolean | Where => {
  if (req.user?.role === 'admin') return true
  return {
    _status: {
      equals: 'published',
    },
  }
}
