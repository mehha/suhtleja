import { randomUUID } from 'crypto'
import type { Payload } from 'payload'

import type { Board, User } from '@/payload-types'

type BoardCell = NonNullable<NonNullable<Board['grid']>['cells']>[number]
type Compound = NonNullable<Board['compounds']>[number]

// The id of a relationship that may come populated.
const idOf = (value: unknown) =>
  typeof value === 'object' && value !== null ? ((value as { id?: number }).id ?? null) : (value as number | null)

/**
 * A copy of a board the user can read (a shared board, or their own), as the user's own private
 * board: "Tee endale koopia" (docs/rules/project/boards.md). The cards and compounds get new ids
 * (their tables key on them), and the compounds follow their cards. Pictures, word classes, the
 * cards' links to boards, the settings and the speech cache come along (the cached audio is shared
 * in R2, keyed by the words). Returns null when the user can't read the board.
 */
export async function copyBoardForUser(payload: Payload, user: User, boardId: number | string) {
  const source = await payload
    .findByID({ collection: 'boards', id: boardId, depth: 0, overrideAccess: false, user })
    .catch(() => null)
  if (!source) return null

  const newIds = new Map<string, string>()
  const cells = (source.grid?.cells ?? []).map((cell: BoardCell) => {
    const id = randomUUID()
    newIds.set(cell.id, id)
    return {
      id,
      x: cell.x,
      y: cell.y,
      w: cell.w,
      h: cell.h,
      title: cell.title,
      image: idOf(cell.image),
      externalImageURL: cell.externalImageURL,
      audio: idOf(cell.audio),
      locked: cell.locked,
      wordClass: cell.wordClass,
      linkBoard: cell.linkBoard,
    }
  })

  // Compounds get new ids too (they key their table), and follow their cards to the new ids.
  const compounds = (source.compounds ?? []).map((compound: Compound) => ({
    id: randomUUID(),
    cells: (compound.cells ?? []).map((cell) => ({ cellId: newIds.get(cell.cellId) ?? cell.cellId })),
    parts: (compound.parts ?? []).map((part) => ({ surface: part.surface, tts: part.tts })),
  }))

  return payload.create({
    collection: 'boards',
    data: {
      name: `${source.name || 'Nimetu tahvel'} (koopia)`,
      // The owner defaults to the user, and the copy is private (both fields are admins' only).
      pinned: false,
      actionBar: source.actionBar,
      extra: source.extra,
      grid: { cols: source.grid?.cols, rows: source.grid?.rows, cells },
      compounds,
      ttsCache: source.ttsCache,
    } as never,
    depth: 0,
    overrideAccess: false,
    user,
  })
}
