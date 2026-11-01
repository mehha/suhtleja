'use client'

import React, { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Board } from '@/payload-types'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { ACTION_ERROR, FLASH_TOASTS, type ActionResult } from '@/utilities/flashToast'
import {
  CircleArrowRight,
  Edit,
  Globe2,
  GripVertical,
  ImageIcon,
  TrashIcon,
  UserCog,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Media } from '@/components/Media'
import { useHydrated } from '@/hooks/useHydrated'

export type HomeBoard = Board & {
  canEdit?: boolean
  isShared?: boolean
  unpinLabel?: string
}

type SortableBoardsProps = {
  boards: HomeBoard[]
  canManage: boolean
  isAdmin?: boolean
  onReorder: (ids: string[]) => Promise<void>
  unpinAction: (formData: FormData) => Promise<ActionResult>
}

type SortableBoardCardProps = {
  board: HomeBoard
  canManage: boolean
  isAdmin?: boolean
  onUnpin: (board: HomeBoard) => void
}

function getVisualCell(board: Board): any | undefined {
  const cells = (board as any)?.grid?.cells as any[] | undefined
  if (!Array.isArray(cells) || cells.length === 0) return undefined
  return cells.find((cell) => cell?.image || cell?.externalImageURL)
}

function SortableBoardCard({
  board,
  canManage,
  isAdmin,
  onUnpin,
}: SortableBoardCardProps) {
  const router = useRouter()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: board.id,
    })

  const visualCell = getVisualCell(board)
  const hasUploadImage =
    visualCell?.image && typeof visualCell.image === 'object' && visualCell.image.url
  const hasExternalImage = visualCell?.externalImageURL

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  const handleCardClick = () => {
    router.push(`/boards/${board.id}`)
  }

  const handleCardKeyDown: React.KeyboardEventHandler<HTMLLIElement> = (event) => {
    // Enter on the card's own buttons and links is theirs, not a request to open the card.
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick()
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="relative flex aspect-[4/3] w-full min-w-0 cursor-pointer flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm ring-1 ring-gray-900/5"
    >
      <TooltipProvider>
        <div className="flex items-center justify-between gap-2">
          {/* DRAG HANDLE – ainult parent mode saab sortida */}
          {canManage ? (
            <button
              type="button"
              {...listeners}
              {...attributes}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              // 32px for a finger around the 20px icon; the margins keep the row and the icon in place.
              className="inline-flex h-8 w-8 -my-1.5 items-center justify-center rounded-lg hover:bg-muted -ml-1.5 cursor-grab touch-none active:cursor-grabbing"
              aria-label="Muuda tahvli järjekorda"
            >
              <GripVertical className="w-5 h-5" />
            </button>
          ) : (
            <span className="w-5 h-5" aria-hidden="true" />
          )}

          {(canManage || board.canEdit) && (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span role="img" aria-label="Vaatad administraatorina" className="inline-flex">
                      <UserCog className="w-5 h-5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Vaatad administraatorina</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {board.isShared ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span role="img" aria-label="Jagatud kõigi kasutajatega" className="inline-flex">
                      <Globe2 className="w-4 h-4 text-sky-600" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Jagatud kõigi kasutajatega</p>
                  </TooltipContent>
                </Tooltip>
              ) : null}

              {board.canEdit ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/boards/${board.id}/edit`}
                      aria-label="Muuda tahvlit"
                      className="inline-flex h-8 w-8 -my-1.5 items-center justify-center rounded-lg hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit className="w-5 h-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Muuda</p>
                  </TooltipContent>
                </Tooltip>
              ) : null}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label={board.unpinLabel ?? 'Eemalda koduvaatest'}
                    className="inline-flex h-8 w-8 -my-1.5 items-center justify-center rounded-lg hover:bg-muted -mr-1.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      onUnpin(board)
                    }}
                    type="button"
                  >
                    <TrashIcon className="w-5 h-5 text-red-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{board.unpinLabel ?? 'Eemalda koduvaatest'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </TooltipProvider>

      <div className="relative flex h-[calc(100%-50px)] w-full items-center justify-center overflow-hidden rounded-lg">
        {hasUploadImage ? (
          <Media
            resource={visualCell.image}
            alt={visualCell.image.alt || board.name}
            pictureClassName="block h-full w-full rounded-xl"
            imgClassName="h-full w-full object-contain"
            priority={false}
          />
        ) : hasExternalImage ? (
          <img
            src={visualCell.externalImageURL as string}
            alt={board.name}
            className="h-full w-full object-contain rounded-2xl"
          />
        ) : (
          <ImageIcon className="h-10 w-10 text-slate-400" />
        )}
      </div>

      <div className="flex-1 flex gap-2 items-center justify-between bg-gray-900/95 text-white py-1 px-3 shadow-sm ring-1 ring-gray-900/5 rounded-xl">
        <h2 className="font-medium">{board.name}</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <CircleArrowRight className="w-8 h-8 stroke-1 fill-pink-100 stroke-gray-900" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Mängi</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </li>
  )
}

export function SortableBoards({
  boards,
  canManage,
  isAdmin,
  onReorder,
  unpinAction,
}: SortableBoardsProps) {
  const [items, setItems] = useState<HomeBoard[]>(boards)
  // A removed card disappears at once; the revalidated list takes over when the save returns, and
  // a failed save brings the card back.
  const [visibleItems, hideItem] = useOptimistic(items, (state, id: HomeBoard['id']) =>
    state.filter((item) => item.id !== id),
  )
  const [, startUnpin] = useTransition()

  const unpin = (board: HomeBoard) => {
    startUnpin(async () => {
      hideItem(board.id)

      const formData = new FormData()
      formData.set('boardId', String(board.id))
      formData.set('visible', 'false')

      // Caught here: an error thrown in a transition would otherwise reach the error page.
      let result: ActionResult
      try {
        result = await unpinAction(formData)
      } catch (error) {
        console.error('Unpin failed', error)
        result = { ok: false, error: ACTION_ERROR }
      }

      if (result.ok) {
        toast.success(FLASH_TOASTS['board-unpinned'].message, { id: 'home-unpin' })
      } else {
        toast.error(result.error, { id: 'home-unpin' })
      }
    })
  }

  const [isPending, startTransition] = useTransition()
  // Drag and drop only once the page runs in the browser.
  const mounted = useHydrated()

  // New boards from the server (after a save) replace the list.
  const [prevBoards, setPrevBoards] = useState(boards)
  if (boards !== prevBoards) {
    setPrevBoards(boards)
    setItems(boards)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canManage) return

    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = visibleItems.findIndex((item) => item.id === active.id)
    const newIndex = visibleItems.findIndex((item) => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const previousItems = items
    const newItems = arrayMove(visibleItems, oldIndex, newIndex)
    setItems(newItems)

    startTransition(async () => {
      // Caught here: an error thrown in a transition would otherwise reach the error page.
      try {
        await onReorder(newItems.map((item) => String(item.id)))
      } catch (error) {
        console.error('Reorder failed', error)
        setItems(previousItems)
        toast.error('Järjekorra salvestamine ebaõnnestus.')
      }
    })
  }

  if (!mounted) {
    return (
      <ul className="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {visibleItems.map((board) => (
          <SortableBoardCard
            key={board.id}
            board={board}
            canManage={false}
            isAdmin={isAdmin}
            onUnpin={unpin}
          />
        ))}
      </ul>
    )
  }

  return (
    <>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={visibleItems.map((item) => item.id)}
          strategy={rectSortingStrategy}
        >
          <ul className="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {visibleItems.map((board) => (
              <SortableBoardCard
                key={board.id}
                board={board}
                canManage={canManage}
                isAdmin={isAdmin}
                onUnpin={unpin}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {isPending && (
        <p className="mt-2 text-xs text-muted-foreground">
          Salvestan järjekorda…
        </p>
      )}
    </>
  )
}
