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

  const layout: Layout[] = useMemo(
    () => cells.map((cell) => toLayoutShape(cell)),
    [cells],
  )

  // ---- SAVE (explicit) ----
  const saveDraft = useCallback(async () => {
    const cellsForServer = cells.map((c) => {
      let image: any = c.image
      if (image && typeof image === 'object' && 'id' in image) {
        image = image.id
      }
      return {
        id: c.id,
        x: c.x, y: c.y, w: c.w, h: c.h,
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
  const onLayoutChange = useCallback((newLayout: Layout[]) => {
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
        x: item.x, y: item.y, w: item.w, h: item.h,
      }
    })
    setCells(nextCells)
    setDirty(true)
  }, [cells, layout])

  const addCell = useCallback(() => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `cell-${Date.now()}`
    // place at the first free row under current content
    const maxBottom = cells.reduce((m, c) => Math.max(m, (c.y ?? 0) + (c.h ?? 1)), 0)
    const newCell: LocalCell = { id, x: 0, y: maxBottom, w: 1, h: 1, title: '' }
    setCells(prev => [...prev, newCell])
    setDirty(true)
  }, [cells])

  // ---- Append NxN below existing cells (DON'T remove existing) ----
  const appendLogicalGrid = useCallback((n: number) => {
    const cellW = Math.max(1, Math.floor(baseCols / n))
    const startY = cells.reduce((m, c) => Math.max(m, (c.y ?? 0) + (c.h ?? 1)), 0)

    const newOnes: LocalCell[] = []
    let i = 0
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        newOnes.push({
          id: `cell-${n}x${n}-${Date.now()}-${i++}`,
          x: col * cellW,
          y: startY + row,
          w: cellW,
          h: 1,
          title: '',
        })
      }
    }
    setCells(prev => [...prev, ...newOnes])
    setDirty(true)
  }, [baseCols, cells])

  const appendRow = useCallback((cellCount: number) => {
    const cellW = Math.max(1, Math.floor(baseCols / cellCount))
    const startY = cells.reduce((m, c) => Math.max(m, (c.y ?? 0) + (c.h ?? 1)), 0)

    const newOnes: LocalCell[] = Array.from({ length: cellCount }, (_, idx) => ({
      id: `cell-row-${cellCount}-${Date.now()}-${idx}`,
      x: idx * cellW,
      y: startY,
      w: cellW,
      h: 1,
      title: '',
    }))

    setCells(prev => [...prev, ...newOnes])
    setDirty(true)
  }, [baseCols, cells])

  const make2x2 = useCallback(() => appendLogicalGrid(2), [appendLogicalGrid])
  const addRow = useCallback(() => appendRow(6), [appendRow])

  const deleteCell = useCallback((cellId: string) => {
    setCells(prev => prev.filter(c => c.id !== cellId))
    setDirty(true)
  }, [])

  const updateCellAction = useCallback((cellId: string, patch: Partial<LocalCell>) => {
    setCells(prev => prev.map(c => (c.id === cellId ? { ...c, ...patch } : c)))
    setDirty(true)
  }, [])

  const clearGrid = useCallback(() => {
    setCells([])
    setDirty(true)
  }, [])

  const updateActionBar = useCallback((enabled: boolean) => {
    if (actionBar.enabled === enabled) return
    setActionBar({ enabled })
    setDirty(true)
  }, [actionBar.enabled])

  const updateAi = useCallback((enabled: boolean) => {
    if (aiEnabled === enabled) return
    setAiEnabled(enabled)
    setDirty(true)
  }, [aiEnabled])

  return {
    // state
    saving, dirty,
    cols: baseCols,
    cells, layout,
    actionBar,
    aiEnabled,

    // callbacks
    onLayoutChange,
    addCell,
    make2x2, addRow,
    deleteCell, clearGrid,
    updateCellAction, updateActionBar,
    saveDraft,
    updateAi
  }
}
