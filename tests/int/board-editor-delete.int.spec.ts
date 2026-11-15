import { describe, expect, it } from 'vitest'

import { removeCell, restoreCell } from '@/app/(frontend)/boards/[id]/edit/BoardEditor/useBoardGrid'

// A column of three cards and one beside it, as the editor holds them.
const cell = (id: string, x: number, y: number, title = id) => ({ id, x, y, w: 1, h: 1, title })
const board = () => [cell('a', 0, 0), cell('b', 0, 1), cell('c', 0, 2), cell('d', 1, 0)]

describe('deleting a card in the board editor', () => {
  it('takes the card off and keeps what is needed to put it back', () => {
    const { cells, deleted } = removeCell(board(), 'b')
    expect(cells.map(({ id }) => id)).toEqual(['a', 'c', 'd'])
    expect(deleted?.cell).toEqual(cell('b', 0, 1))
    expect(deleted?.index).toBe(1)
  })

  it('leaves the board alone when the card is not on it', () => {
    const cells = board()
    expect(removeCell(cells, 'x')).toEqual({ cells, deleted: null })
  })

  it('puts the card back where it stood, and the cards that moved up into its place too', () => {
    const { cells, deleted } = removeCell(board(), 'b')
    // The grid closed the gap: the card under the deleted one moved up.
    const compacted = cells.map((current) => (current.id === 'c' ? { ...current, y: 1 } : current))
    expect(restoreCell(compacted, deleted!)).toEqual(board())
  })

  it('keeps what changed since: an edited card stays edited and a new card stays', () => {
    const { cells, deleted } = removeCell(board(), 'b')
    const since = [...cells.map((current) => (current.id === 'a' ? { ...current, title: 'uus tekst' } : current)), cell('e', 0, 3)]
    const restored = restoreCell(since, deleted!)
    expect(restored.find(({ id }) => id === 'a')?.title).toBe('uus tekst')
    expect(restored.find(({ id }) => id === 'e')).toEqual(cell('e', 0, 3))
    expect(restored.find(({ id }) => id === 'b')).toEqual(cell('b', 0, 1))
  })

  it('brings several deleted cards back in turn, newest first', () => {
    const first = removeCell(board(), 'a')
    const second = removeCell(first.cells, 'c')
    const afterSecond = restoreCell(second.cells, second.deleted!)
    expect(restoreCell(afterSecond, first.deleted!)).toEqual(board())
  })
})
