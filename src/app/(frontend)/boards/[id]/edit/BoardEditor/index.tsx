// src/components/BoardEditor/index.tsx (või src/app/(frontend)/boards/[id]/edit/AppEditor/index.tsx)
'use client'

import ReactGridLayout, { type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import type { Board, Media } from '@/payload-types'
import { useBoardGrid } from './useBoardGrid'
import { BoardEditorToolbar } from './Toolbar'
import { CellEditModal } from './CellEditModal'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Play, Trash, WholeWord, Edit3, Check, X, Settings2, GripVertical } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import { useUnsavedChangesGuard } from '@/utilities/useUnsavedChangesGuard'
import { FLASH_TOASTS, type ActionResult } from '@/utilities/flashToast'
import { toast } from 'sonner'
import { CellLabel } from '../../CellLabel'

const COMPACT_SWITCH_CLASS =
  'h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4'
const TOGGLE_CARD_CLASS = 'flex items-center gap-2 rounded-xl border bg-card px-2.5 py-1.5'
const GRID_MARGIN: [number, number] = [16, 16]
// The narrowest cell that still fits its grip and buttons.
const MIN_CELL_WIDTH = 96

const layoutsMatch = (a: Layout[], b: Layout[]) => {
  if (a.length !== b.length) return false

  return a.every((item) => {
    const other = b.find((candidate) => candidate.i === item.i)
    return (
      other &&
      item.x === other.x &&
      item.y === other.y &&
      item.w === other.w &&
      item.h === other.h
    )
  })
}

const packLayoutToColumns = (items: Layout[], colCount: number): Layout[] => {
  const safeColCount = Math.max(1, colCount)
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const colHeights = Array.from({ length: safeColCount }, () => 0)

  return sorted.map((item) => {
    const h = Math.max(1, item.h)
    const w = Math.max(1, Math.min(item.w, safeColCount))
    const maxX = Math.max(0, safeColCount - w)
    const colIndex = colHeights.reduce(
      (shortestIndex, height, index) =>
        height < colHeights[shortestIndex] && index <= maxX ? index : shortestIndex,
      0,
    )
    const x = Math.min(colIndex, maxX)
    const y = colHeights[x]

    for (let col = x; col < x + w; col += 1) {
      colHeights[col] = y + h
    }

    return { ...item, x, y, w, h }
  })
}

const scaleLayoutToColumns = (items: Layout[], fromCols: number, toCols: number): Layout[] =>
  items.map((item) => {
    const w = Math.max(1, Math.min(toCols, Math.round((item.w / fromCols) * toCols)))
    const x = Math.max(0, Math.min(toCols - w, Math.round((item.x / fromCols) * toCols)))

    return { ...item, x, w }
  })

type Props = {
  board: Board
  isAdmin: boolean
  renameBoard: (formData: FormData) => Promise<ActionResult>
  updateBoardHomeVisibility: (formData: FormData) => Promise<ActionResult>
  updateBoardVisibility: (formData: FormData) => Promise<ActionResult>
}

type Compound = NonNullable<Board['compounds']>[number]

export default function BoardEditor({
  board,
  isAdmin,
  renameBoard,
  updateBoardHomeVisibility,
  updateBoardVisibility,
}: Props) {
  const {
    saving,
    saveProgress,
    dirty,
    cols,
    cells,
    layout,
    onLayoutChange,
    addCell,
    appendBlock,
    appendTextCells,
    deleteCell,
    clearGrid,
    updateCellAction,
    actionBar,
    updateActionBar,
    saveDraft,
    aiEnabled,
    updateAi,
  } = useBoardGrid(board)

  const [editingCellId, setEditingCellId] = useState<string | null>(null)
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const homeVisibilityFormRef = useRef<HTMLFormElement | null>(null)
  const visibilityFormRef = useRef<HTMLFormElement | null>(null)

  // title edit local state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(board.name ?? '')

  const [gridWidth, setGridWidth] = useState(0)

  useEffect(() => {
    const element = gridContainerRef.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      setGridWidth(entry.contentRect.width)
    })
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const mobileCols = Math.max(1, Math.min(cols, 3))
  const mdCols = Math.max(1, Math.min(cols, 4))
  const activeGridCols = useMemo(() => {
    if (!gridWidth || gridWidth >= 1024) return cols
    const fullCellWidth = (gridWidth - GRID_MARGIN[0] * Math.max(0, cols - 1)) / cols
    if (fullCellWidth >= MIN_CELL_WIDTH) return cols
    if (gridWidth >= 768) return mdCols
    return mobileCols
  }, [cols, gridWidth, mdCols, mobileCols])
  // With fewer columns than the board has, the grid shows a rearranged copy. A change there can't
  // be mapped back to the board's own columns without moving and widening every cell, so the
  // layout is read-only until the screen is wide enough.
  const layoutLocked = activeGridCols !== cols
  const rowHeight = useMemo(() => {
    if (!gridWidth) return 140

    const horizontalGaps = GRID_MARGIN[0] * Math.max(0, activeGridCols - 1)
    return Math.max(48, Math.floor((gridWidth - horizontalGaps) / activeGridCols))
  }, [activeGridCols, gridWidth])
  const editorLayout = useMemo(() => {
    if (activeGridCols === cols) return layout

    const scaledLayout = scaleLayoutToColumns(layout, cols, activeGridCols)
    return packLayoutToColumns(scaledLayout, activeGridCols)
  }, [activeGridCols, cols, layout])
  const handleEditorLayoutChange = (nextLayout: Layout[]) => {
    if (layoutLocked || layoutsMatch(nextLayout, editorLayout)) return

    onLayoutChange(nextLayout)
  }

  const currentEditingCell =
    editingCellId != null ? (cells.find((c) => c.id === editingCellId) ?? null) : null

  const handleModalSave = (
    cellId: string,
    patch: {
      title?: string
      externalImageURL?: string
      h?: number
      image?: string | number | { id: string | number; url?: string } | null
    },
  ) => {
    void updateCellAction(cellId, patch as any)
  }

  const cellImageSrc = (cell: {
    externalImageURL?: string | null
    image?: number | Media | null
  }): string =>
    cell?.externalImageURL ||
    (cell?.image && typeof cell.image === 'object' && cell.image.url) ||
    ''

  const renderCellImage = (cell: any) => {
    const src = cellImageSrc(cell)
    if (!src) return null
    return (
      <div className="relative min-h-0 w-full flex-1 p-2 pb-1">
        <Image
          src={src}
          alt={cell.title ?? ''}
          fill
          sizes="(max-width: 768px) 100vw, 1200px"
          className="rounded object-contain p-2"
        />
      </div>
    )
  }

  const compounds = (board.compounds ?? []) as Compound[]
  const {
    dialogOpen: leaveDialogOpen,
    setDialogOpen: setLeaveDialogOpen,
    confirmNavigation: confirmLeave,
  } = useUnsavedChangesGuard({
    enabled: dirty,
  })

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="xl:container mb-10">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-2">
            {/* Title + edit */}
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <form
                  action={async (formData) => {
                    const result = await renameBoard(formData)
                    if (!result.ok) toast.error(result.error)
                  }}
                  className="flex items-center gap-2"
                  onSubmit={() => {
                    setIsEditingTitle(false)
                  }}
                >
                  <input type="hidden" name="boardId" value={String(board.id)} />
                  <Input
                    name="name"
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="h-9 w-64 text-lg font-semibold"
                    placeholder="Nimetu tahvel"
                  />
                  <Button type="submit" size="icon" variant="ghost" className="h-8 w-8">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => {
                      setIsEditingTitle(false)
                      setTitleDraft(board.name ?? '')
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <>
                <h1 className="text-3xl font-semibold leading-6">{board.name || 'Nimetu tahvel'}</h1>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Parempoolsed nupud */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/koduhaldus">Tagasi koduhaldusse</Link>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => void saveDraft()}
                disabled={!dirty || saving}
              >
                {saving ? (
                  <>
                    <Spinner className="mr-2" />
                    Salvestan…
                  </>
                ) : dirty ? (
                  'Salvesta'
                ) : (
                  'Salvestatud'
                )}
              </Button>

              {/* Halda sõnaühendeid + tooltip */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/boards/${board.id}/compounds`}>
                      <WholeWord className="mr-2 h-5 w-5 text-pink-600" />
                      Halda sõnaühendeid
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  {compounds.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sõnaühendeid pole veel lisatud.</p>
                  ) : (
                    <div className="max-h-[260px] space-y-2 overflow-y-auto text-xs">
                      {compounds.map((compound) => {
                        const surfaces = compound.parts?.map((p) => p.surface).join(' ') ?? ''

                        return (
                          <div key={compound.id} className="rounded border bg-muted/40 px-2 py-1">
                            <div className="font-medium">{surfaces || '—'}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>

              {/* Same place as the board view's "Muuda tahvlit", so the two pages switch back and forth. */}
              <Button variant="positive" size="sm" asChild>
                <Link href={`/boards/${board.id}`} className="gap-2">
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Vaata tahvlit
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <BoardEditorToolbar
              onAddCellAction={addCell}
              onAddBlockAction={appendBlock}
              onAddTextCellsAction={appendTextCells}
              onClearAction={clearGrid}
              disableClear={cells.length === 0}
            />
            <div className="flex items-center gap-3">
              <form
                ref={homeVisibilityFormRef}
                id="board-home-visibility-form"
                action={async (formData) => {
                  const result = await updateBoardHomeVisibility(formData)
                  if (!result.ok) {
                    toast.error(result.error)
                    return
                  }
                  const pinned = formData.get('pinned') === 'true'
                  toast.success(FLASH_TOASTS[pinned ? 'board-pinned' : 'board-unpinned'].message)
                }}
                className={TOGGLE_CARD_CLASS}
              >
                <input type="hidden" name="boardId" value={String(board.id)} />
                <input type="hidden" name="pinned" value={board.pinned ? 'false' : 'true'} />
                <div className="flex flex-col">
                  <Label htmlFor="board-home-visibility-toggle" className="text-sm">
                    {board.pinned ? 'Koduvaates sees' : 'Koduvaates väljas'}
                  </Label>
                  {dirty ? (
                    <p className="text-xs text-muted-foreground">
                      Salvesta ruudustiku muudatused enne koduvaate nähtavuse muutmist.
                    </p>
                  ) : null}
                </div>
                <Switch
                  id="board-home-visibility-toggle"
                  className={COMPACT_SWITCH_CLASS}
                  checked={!!board.pinned}
                  disabled={dirty}
                  onCheckedChange={() => {
                    homeVisibilityFormRef.current?.requestSubmit()
                  }}
                />
              </form>
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="icon" aria-label="Lisaseaded">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Lisaseaded</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-1">
                    {isAdmin ? (
                      <form
                        ref={visibilityFormRef}
                        id="board-visibility-form"
                        action={async (formData) => {
                          const result = await updateBoardVisibility(formData)
                          if (!result.ok) {
                            toast.error(result.error)
                            return
                          }
                          const shared = formData.get('visibleToAllUsers') === 'true'
                          toast.success(
                            FLASH_TOASTS[shared ? 'board-shared' : 'board-unshared'].message,
                          )
                        }}
                        className={TOGGLE_CARD_CLASS}
                      >
                        <input type="hidden" name="boardId" value={String(board.id)} />
                        <input
                          type="hidden"
                          name="visibleToAllUsers"
                          value={board.visibleToAllUsers ? 'false' : 'true'}
                        />
                        <div className="flex flex-col">
                          <Label htmlFor="board-visibility-toggle" className="text-sm">
                            {board.visibleToAllUsers ? 'Kõigile nähtav' : 'Ainult omanikule'}
                          </Label>
                          {dirty ? (
                            <p className="text-xs text-muted-foreground">
                              Salvesta ruudustiku muudatused enne nähtavuse muutmist.
                            </p>
                          ) : null}
                        </div>
                        <Switch
                          id="board-visibility-toggle"
                          className={COMPACT_SWITCH_CLASS}
                          checked={!!board.visibleToAllUsers}
                          disabled={dirty}
                          onCheckedChange={() => {
                            visibilityFormRef.current?.requestSubmit()
                          }}
                        />
                      </form>
                    ) : null}
                    <div className={TOGGLE_CARD_CLASS}>
                      <Switch
                        id="action-bar-toggle"
                        className={COMPACT_SWITCH_CLASS}
                        checked={actionBar.enabled}
                        onCheckedChange={(checked) => {
                          void updateActionBar(checked)
                        }}
                      />
                      <Label htmlFor="action-bar-toggle">
                        {actionBar.enabled ? 'Tegevusriba sees' : 'Tegevusriba väljas'}
                      </Label>
                    </div>
                    <div className={TOGGLE_CARD_CLASS}>
                      <Switch
                        id="action-ai-toggle"
                        className={COMPACT_SWITCH_CLASS}
                        checked={aiEnabled}
                        onCheckedChange={(checked) => {
                          void updateAi(checked)
                        }}
                      />
                      <Label htmlFor="action-ai-toggle">
                        {aiEnabled ? 'AI sees' : 'AI väljas'}
                      </Label>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {saving && (
          <div className="container space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Salvestan…</span>
              <span>{saveProgress}%</span>
            </div>
            <Progress value={saveProgress} className="h-2" />
          </div>
        )}

        {layoutLocked ? (
          <p className="container text-sm text-muted-foreground">
            Kaartide liigutamiseks ja suuruse muutmiseks ava tahvel laiemal ekraanil.
          </p>
        ) : null}

        {/* Not a scroll container: the page scrolls. The grid gets the width measured here rather
            than from WidthProvider, which only re-measures on window resize, so cell widths and the
            square row height always come from the same number. It renders once that width is
            known, so cells don't first appear at a fallback size and animate to the real one. */}
        <div ref={gridContainerRef} className="w-full">
          {gridWidth > 0 ? (
            <ReactGridLayout
              className="layout board-editor-grid"
              width={gridWidth}
              cols={activeGridCols}
              rowHeight={rowHeight}
              margin={GRID_MARGIN}
              containerPadding={[0, 0]}
              layout={editorLayout}
              onLayoutChange={handleEditorLayoutChange}
              isResizable={!layoutLocked}
              isDraggable={!layoutLocked}
              // Cells move only by their grip. react-draggable cancels touchstart on whatever it
              // drags, so dragging from the whole cell kept the cell buttons from getting taps.
              draggableHandle=".board-cell-drag-handle"
            >
              {cells.map((cell) => (
                <div
                  key={cell.id}
                  className="relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-white p-2 shadow-lg ring-1 ring-gray-900/5"
                >
                  {/* The cell's controls (grip, edit, delete and the resize corner, styled in
                      globals.css) are all 28px with 8px corners, and 8px from the edges, the cell's
                      own padding; 4px in cells under 112px wide, so they still fit at the 96px
                      minimum. rounded-[0.5rem], not rounded-lg: the theme's lg is 3.2px. */}
                  {layoutLocked ? null : (
                    <span
                      aria-label="Lohista kaardi liigutamiseks"
                      className="board-cell-drag-handle absolute left-2 top-2 z-10 inline-flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-[0.5rem] text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:cursor-grabbing"
                      role="img"
                    >
                      <GripVertical className="h-5 w-5" />
                    </span>
                  )}

                  <div className="board-cell-controls absolute right-2 top-2 z-10 flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 rounded-[0.5rem] p-0"
                      aria-label="Muuda kaarti"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        setEditingCellId(cell.id)
                      }}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7 rounded-[0.5rem] p-0"
                      aria-label="Kustuta kaart"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        deleteCell(cell.id)
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>

                  {renderCellImage(cell)}

                  {cell.title && (
                    // Without a picture the label comes first; keep it below the controls.
                    <CellLabel
                      title={cell.title}
                      className={cellImageSrc(cell) ? undefined : 'pt-8'}
                    />
                  )}
                </div>
              ))}
            </ReactGridLayout>
          ) : null}
        </div>

        <CellEditModal
          open={!!currentEditingCell}
          onOpenChange={(open) => {
            if (!open) {
              setEditingCellId(null)
            }
          }}
          cell={
            currentEditingCell
              ? {
                  id: currentEditingCell.id,
                  title: currentEditingCell.title ?? '',
                  externalImageURL: currentEditingCell.externalImageURL ?? '',
                  h: currentEditingCell.h ?? 1,
                  image: currentEditingCell.image,
                }
              : null
          }
          onSaveAction={handleModalSave}
        />

        <UnsavedChangesDialog
          open={leaveDialogOpen}
          onOpenChange={setLeaveDialogOpen}
          onConfirm={confirmLeave}
        />
      </div>
    </TooltipProvider>
  )
}
