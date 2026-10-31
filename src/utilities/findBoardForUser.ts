import type { Payload } from 'payload'
import type { Board, User } from '@/payload-types'

export function getBoardOwnerId(board: Pick<Board, 'owner'>): number {
  return typeof board.owner === 'object' && board.owner !== null ? board.owner.id : board.owner
}

/**
 * A board as `user` may see it, ready to hand to a client component, or null when it doesn't exist
 * or the user may not read it. The collection's read access decides (owner, shared board, admin).
 *
 * Board pages pass the board to the browser, so it carries no user documents: the owner stays an id
 * (populated, it is a whole user document: email, PIN hash, Stripe ids), and depth 1 fills the
 * cells' images and audio but not who uploaded them.
 */
export async function findBoardForUser(
  payload: Payload,
  user: User,
  id: number | string,
): Promise<Board | null> {
  const board = await payload.findByID({
    collection: 'boards',
    id,
    depth: 1,
    overrideAccess: false,
    user,
    disableErrors: true,
  })

  if (!board) return null
  return { ...board, owner: getBoardOwnerId(board) }
}
