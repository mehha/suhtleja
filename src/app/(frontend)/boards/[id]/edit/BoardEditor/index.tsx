// src/components/BoardEditor/index.tsx (või src/app/(frontend)/boards/[id]/edit/AppEditor/index.tsx)
'use client'

import RGL, { WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import type { Board, Media } from '@/payload-types'
import { useBoardGrid } from './useBoardGrid'
import { BoardEditorToolbar } from './Toolbar'
import { useViewportHeight } from '@/utilities/useViewportHeight'
import { CellEditModal } from './CellEditModal'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Play, Trash, WholeWord, Edit3, Check, X, Settings2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import { useUnsavedChangesGuard } from '@/utilities/useUnsavedChangesGuard'

const ReactGridLayout = WidthProvider(RGL)
const COMPACT_SWITCH_CLASS =
  'h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4'
const TOGGLE_CARD_CLASS = 'flex items-center gap-2 rounded-xl border bg-card px-2.5 py-1.5'

type Props = {
  board: Board
  isAdmin: boolean
  renameBoard: (formData: FormData) => Promise<void>
  updateBoardHomeVisibility: (formData: FormData) => Promise<void>
  updateBoardVisibility: (formData: FormData) => Promise<void>
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

  const vh = useViewportHeight()
  const [editingCellId, setEditingCellId] = useState<string | null>(null)
  const homeVisibilityFormRef = useRef<HTMLFormElement | null>(null)
  const visibilityFormRef = useRef<HTMLFormElement | null>(null)

  // title edit local state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(board.name ?? '')

  const rowsNeeded = layout.length > 0 ? Math.max(...layout.map((l) => (l.y ?? 0) + (l.h ?? 1))) : 1

  const TOP_BAR = 36,
    HEADER = 98,
    FOOTER = 105,
    EXTRA = 24
  const reserved = TOP_BAR + HEADER + FOOTER + EXTRA
  const available = Math.max(200, vh - reserved)
  let rowHeight = Math.floor(available / rowsNeeded)
  rowHeight = Math.min(240, Math.max(48, rowHeight))

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

  const renderCellImage = (cell: any) => {
    const src =
      cell?.externalImageURL ||
      (cell?.image && typeof cell.image === 'object' && (cell.image as Media).url) ||
      ''
    if (!src) return null
    return (
      <div className="relative h-full w-full min-h-[4rem]">
        <Image
          src={src}
          alt={cell.title ?? ''}
          fill
          sizes="(max-width: 768px) 100vw, 1200px"
          className="rounded object-contain"
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
        <div className="container mb-10">
          <div className="mb-10 flex items-center justify-between gap-2">
            {/* Title + edit */}
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <form
                  action={renameBoard}
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
            <div className="flex items-center gap-2">
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

              <Link href={`/boards/${board.id}`}>
                <Button variant="positive" size="sm">
                  <Play className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
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
                action={updateBoardHomeVisibility}
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
                        action={updateBoardVisibility}
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

        {saving && <p className="container text-xs text-slate-500">Salvestan…</p>}

        <div className="h-full w-full overflow-y-auto">
          <ReactGridLayout
            className="layout"
            cols={cols}
            rowHeight={200}
            width={1200}
            layout={layout}
            onLayoutChange={onLayoutChange}
            isResizable
            isDraggable
          >
            {cells.map((cell) => (
              <div
                key={cell.id}
                className="relative flex aspect-[4/3] flex-col gap-1 overflow-hidden rounded-xl bg-white p-0 shadow-lg ring-1 ring-gray-900/5"
              >
                <div className="absolute right-1 top-1 z-10 flex gap-1">
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      setEditingCellId(cell.id)
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    Muuda
                  </Button>

                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      deleteCell(cell.id)
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Trash width={14} />
                  </Button>
                </div>

                {renderCellImage(cell)}

                {cell.title && (
                  <div className="absolute bottom-0 left-0 w-full bg-slate-800/85 p-2 text-center text-white">
                    <div className="break-words text-2xl leading-4">{cell.title}</div>
                  </div>
                )}
              </div>
            ))}
          </ReactGridLayout>
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
