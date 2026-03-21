// src/components/BoardEditor/useBoardGrid.ts
'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Layout } from 'react-grid-layout'
import type { Board } from '@/payload-types'
import { getClientSideURL } from '@/utilities/getURL'

type Grid = NonNullable<Board['grid']>
type Cells = NonNullable<Grid['cells']>
type Cell = Cells[number]

type LocalCell = Cell & {
  image?: Cell['image'] | { id: string | number; url?: string } | null
}

type BulkTextCellInput = {
  externalImageURL?: string
  title: string
}

type LayoutShape = Pick<Layout, 'i' | 'x' | 'y' | 'w' | 'h'>

function toLayoutShape(cell: LocalCell): LayoutShape {
  return {
    i: cell.id,
    x: cell.x ?? 0,
    y: cell.y ?? 0,
    w: cell.w ?? 1,
    h: cell.h ?? 1,
  }
}

function sortLayout(layout: LayoutShape[]) {
  return [...layout].sort((a, b) => a.i.localeCompare(b.i))
}

function layoutsMatch(a: LayoutShape[], b: LayoutShape[]) {
  if (a.length !== b.length) return false

  const sortedA = sortLayout(a)
  const sortedB = sortLayout(b)

  return sortedA.every((item, index) => {
    const other = sortedB[index]
    return (
      item.i === other.i &&
      item.x === other.x &&
      item.y === other.y &&
      item.w === other.w &&
      item.h === other.h
    )
  })
}

function getNextRow(cells: LocalCell[]) {
  return cells.reduce((maxBottom, cell) => Math.max(maxBottom, (cell.y ?? 0) + (cell.h ?? 1)), 0)
}

export function useBoardGrid(board: Board) {
  const baseCols = board.grid?.cols ?? 12

  // ---- DRAFT STATE (no autosave) ----
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [actionBar, setActionBar] = useState<{ enabled: boolean }>(() => ({
    enabled: board.actionBar?.enabled !== false,
  }))

  const [aiEnabled, setAiEnabled] = useState<boolean>(() => {
    return board.extra?.ai ?? false // vaikimisi false
  })

  const [cells, setCells] = useState<LocalCell[]>(() => {
    const initial = board.grid?.cells ?? []
    return initial.map((c) => c as LocalCell)
  })

  const layout: Layout[] = useMemo(() => cells.map((cell) => toLayoutShape(cell)), [cells])

  // ---- SAVE (explicit) ----
  const saveDraft = useCallback(async () => {
    const cellsForServer = cells.map((c) => {
      let image: any = c.image
      if (image && typeof image === 'object' && 'id' in image) {
        image = image.id
      }
      return {
        id: c.id,
        x: c.x,
        y: c.y,
        w: c.w,
        h: c.h,
        title: c.title ?? undefined,
        externalImageURL: c.externalImageURL ?? undefined,
        audio: c.audio ?? undefined,
        image,
      }
    })

    setSaving(true)
    await fetch(`${getClientSideURL()}/api/boards/${board.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionBar,
        extra: {
          ...(board.extra || {}),
          ai: aiEnabled,
        },
        grid: { ...(board.grid || {}), cols: baseCols, cells: cellsForServer },
      }),
    })
    setSaving(false)
    setDirty(false)
  }, [board.id, board.grid, baseCols, cells, actionBar, aiEnabled, board.extra])

  // ---- RGL change: mark dirty, no save ----
  const onLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      const nextLayout = newLayout.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      }))

      if (layoutsMatch(layout, nextLayout)) {
        return
      }

      const nextCells: LocalCell[] = newLayout.map((item) => {
        const orig = cells.find((c) => c.id === item.i)
        return {
          ...(orig || { id: item.i, title: '' }),
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        }
      })
      setCells(nextCells)
      setDirty(true)
    },
    [cells, layout],
  )

  const addCell = useCallback(() => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `cell-${Date.now()}`
    const newCell: LocalCell = { id, x: 0, y: getNextRow(cells), w: 1, h: 1, title: '' }
    setCells((prev) => [...prev, newCell])
    setDirty(true)
  }, [cells])

  const appendBlock = useCallback(
    (rows: number, cols: number) => {
      const safeRows = Math.max(1, Math.min(12, Math.floor(rows)))
      const safeCols = Math.max(1, Math.min(12, Math.floor(cols)))
      const cellW = Math.max(1, Math.floor(baseCols / safeCols))
      const startY = getNextRow(cells)
      const timestamp = Date.now()

      const newCells: LocalCell[] = []
      let index = 0

      for (let row = 0; row < safeRows; row += 1) {
        for (let col = 0; col < safeCols; col += 1) {
          newCells.push({
            id: `cell-block-${safeRows}x${safeCols}-${timestamp}-${index}`,
            x: col * cellW,
            y: startY + row,
            w: cellW,
            h: 1,
            title: '',
          })
          index += 1
        }
      }

      setCells((prev) => [...prev, ...newCells])
      setDirty(true)
    },
    [baseCols, cells],
  )

  const appendTextCells = useCallback(
    (items: BulkTextCellInput[]) => {
      const normalizedItems = items
        .map((item) => ({
          title: item.title.trim(),
          externalImageURL: item.externalImageURL?.trim() || '',
        }))
        .filter((item) => item.title)

      if (!normalizedItems.length) {
        return
      }

      const startY = getNextRow(cells)
      const maxColsPerRow = Math.max(1, Math.min(baseCols, 6))
      const cellsPerRow = Math.min(normalizedItems.length, maxColsPerRow)
      const timestamp = Date.now()
      const newCells: LocalCell[] = []

      normalizedItems.forEach((item, index) => {
        const row = Math.floor(index / cellsPerRow)
        const col = index % cellsPerRow
        const itemsInThisRow = Math.min(
          cellsPerRow,
          normalizedItems.length - row * cellsPerRow,
        )
        const cellW = Math.max(1, Math.floor(baseCols / itemsInThisRow))

        newCells.push({
          id: `cell-bulk-${timestamp}-${index}`,
          x: col * cellW,
          y: startY + row,
          w: cellW,
          h: 1,
          title: item.title,
          externalImageURL: item.externalImageURL,
        })
      })

      setCells((prev) => [...prev, ...newCells])
      setDirty(true)
    },
    [baseCols, cells],
  )

  const deleteCell = useCallback((cellId: string) => {
    setCells((prev) => prev.filter((c) => c.id !== cellId))
    setDirty(true)
  }, [])

  const updateCellAction = useCallback((cellId: string, patch: Partial<LocalCell>) => {
    setCells((prev) => prev.map((c) => (c.id === cellId ? { ...c, ...patch } : c)))
    setDirty(true)
  }, [])

  const clearGrid = useCallback(() => {
    setCells([])
    setDirty(true)
  }, [])

  const updateActionBar = useCallback(
    (enabled: boolean) => {
      if (actionBar.enabled === enabled) return
      setActionBar({ enabled })
      setDirty(true)
    },
    [actionBar.enabled],
  )

  const updateAi = useCallback(
    (enabled: boolean) => {
      if (aiEnabled === enabled) return
      setAiEnabled(enabled)
      setDirty(true)
    },
    [aiEnabled],
  )

  return {
    saving,
    dirty,
    cols: baseCols,
    cells,
    layout,
    actionBar,
    aiEnabled,
    onLayoutChange,
    addCell,
    appendBlock,
    appendTextCells,
    deleteCell,
    clearGrid,
    updateCellAction,
    updateActionBar,
    saveDraft,
    updateAi,
  }
}
