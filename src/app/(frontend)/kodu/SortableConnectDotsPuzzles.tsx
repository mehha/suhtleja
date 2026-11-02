'use client'

import React, { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { CircleArrowRight, Edit, EyeOff, Globe2, GripVertical, PencilRuler, UserCog } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ConnectDotsPuzzle } from '@/utilities/connectDots'
import { useHydrated } from '@/hooks/useHydrated'

export type HomeConnectDotsPuzzle = ConnectDotsPuzzle & {
  canEdit?: boolean
  isShared?: boolean
  unpinLabel?: string
}

type SortableConnectDotsPuzzlesProps = {
  canManage: boolean
  isAdmin?: boolean
  onReorder: (ids: string[]) => Promise<void>
  puzzles: HomeConnectDotsPuzzle[]
  unpinAction: (formData: FormData) => Promise<ActionResult>
}

type SortablePuzzleCardProps = {
  canManage: boolean
  isAdmin?: boolean
  onUnpin: (puzzle: HomeConnectDotsPuzzle) => void
  puzzle: HomeConnectDotsPuzzle
}

function SortablePuzzleCard({
  canManage,
  isAdmin,
  onUnpin,
  puzzle,
}: SortablePuzzleCardProps) {
  const router = useRouter()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: puzzle.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  const handleCardClick = () => {
    router.push(`/connect-dots?puzzle=${puzzle.id}`)
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
              aria-label="Muuda mängude järjekorda"
            >
              <GripVertical className="h-5 w-5" />
            </button>
          ) : (
            <span aria-hidden="true" className="h-5 w-5" />
          )}

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  role="img"
                  aria-label="Ühenda punktid"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-800"
                >
                  <PencilRuler className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ühenda punktid</p>
              </TooltipContent>
            </Tooltip>

            {(canManage || puzzle.canEdit) && (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span role="img" aria-label="Vaatad administraatorina" className="inline-flex">
                        <UserCog className="h-5 w-5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Vaatad administraatorina</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {puzzle.isShared ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span role="img" aria-label="Jagatud kõigi kasutajatega" className="inline-flex">
                        <Globe2 className="h-4 w-4 text-sky-600" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Jagatud kõigi kasutajatega</p>
                    </TooltipContent>
                  </Tooltip>
                ) : null}

                {puzzle.canEdit ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={`/connect-dots/manage/${puzzle.id}`}
                        aria-label="Muuda mängu"
                        className="inline-flex h-8 w-8 -my-1.5 items-center justify-center rounded-lg hover:bg-muted"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Edit className="h-5 w-5" />
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
                      aria-label={puzzle.unpinLabel ?? 'Eemalda koduvaatest'}
                      className="inline-flex h-8 w-8 -my-1.5 items-center justify-center rounded-lg hover:bg-muted -mr-1.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        onUnpin(puzzle)
                      }}
                      type="button"
                    >
                      <EyeOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{puzzle.unpinLabel ?? 'Eemalda koduvaatest'}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>

      <div className="relative h-[calc(100%-50px)] w-full overflow-hidden rounded-lg bg-[radial-gradient(circle_at_top,#f8fafc,#e2e8f0)]">
        <img src={puzzle.imageUrl} alt={puzzle.title} className="h-full w-full object-contain" />
      </div>

      <div className="flex flex-1 items-center justify-between gap-2 rounded-xl bg-gray-900/95 px-3 py-1 text-white shadow-sm ring-1 ring-gray-900/5">
        <h2 className="font-medium">{puzzle.title}</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <CircleArrowRight className="h-8 w-8 fill-pink-100 stroke-gray-900 stroke-1" />
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

export function SortableConnectDotsPuzzles({
  canManage,
  isAdmin,
  onReorder,
  puzzles,
  unpinAction,
}: SortableConnectDotsPuzzlesProps) {
  const [items, setItems] = useState<HomeConnectDotsPuzzle[]>(puzzles)
  // A removed card disappears at once; the revalidated list takes over when the save returns, and
  // a failed save brings the card back.
  const [visibleItems, hideItem] = useOptimistic(items, (state, id: HomeConnectDotsPuzzle['id']) =>
    state.filter((item) => item.id !== id),
  )
  const [, startUnpin] = useTransition()

  const unpin = (puzzle: HomeConnectDotsPuzzle) => {
    startUnpin(async () => {
      hideItem(puzzle.id)

      const formData = new FormData()
      formData.set('puzzleId', String(puzzle.id))
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
        toast.success(FLASH_TOASTS['game-unpinned'].message, { id: 'home-unpin' })
      } else {
        toast.error(result.error, { id: 'home-unpin' })
      }
    })
  }

  const [isPending, startTransition] = useTransition()
  // Drag and drop only once the page runs in the browser.
  const mounted = useHydrated()

  // New puzzles from the server (after a save) replace the list.
  const [prevPuzzles, setPrevPuzzles] = useState(puzzles)
  if (puzzles !== prevPuzzles) {
    setPrevPuzzles(puzzles)
    setItems(puzzles)
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
        await onReorder(newItems.map((item) => item.id))
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
        {visibleItems.map((puzzle) => (
          <SortablePuzzleCard
            key={puzzle.id}
            canManage={false}
            isAdmin={isAdmin}
            puzzle={puzzle}
            onUnpin={unpin}
          />
        ))}
      </ul>
    )
  }

  return (
    <>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleItems.map((item) => item.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {visibleItems.map((puzzle) => (
              <SortablePuzzleCard
                key={puzzle.id}
                canManage={canManage}
                isAdmin={isAdmin}
                puzzle={puzzle}
                onUnpin={unpin}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {isPending && <p className="mt-2 text-xs text-muted-foreground">Salvestan järjekorda…</p>}
    </>
  )
}
