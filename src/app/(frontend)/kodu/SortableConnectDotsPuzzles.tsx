'use client'

import React, { useEffect, useState, useTransition } from 'react'
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
import { CircleArrowRight, Edit, Globe2, GripVertical, PencilRuler, TrashIcon, UserCog } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ConnectDotsPuzzle } from '@/utilities/connectDots'

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
  unpinAction: (formData: FormData) => Promise<void>
}

type SortablePuzzleCardProps = {
  canManage: boolean
  isAdmin?: boolean
  puzzle: HomeConnectDotsPuzzle
  unpinAction: (formData: FormData) => Promise<void>
}

function SortablePuzzleCard({
  canManage,
  isAdmin,
  puzzle,
  unpinAction,
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
            className="cursor-grab touch-none hover:bg-muted active:cursor-grabbing"
            aria-label="Muuda puzzle järjekorda"
          >
            <GripVertical className="h-5 w-5" />
          </button>
        ) : (
          <span aria-hidden="true" className="h-5 w-5" />
        )}

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[11px] font-medium text-sky-800">
            <PencilRuler className="h-3.5 w-3.5" />
            Connect Dots
          </span>

          {(canManage || puzzle.canEdit) && (
            <TooltipProvider>
              <div className="flex items-center gap-2">
                {isAdmin && <UserCog className="h-5 w-5" />}
                {puzzle.isShared ? <Globe2 className="h-4 w-4 text-sky-600" /> : null}

                {puzzle.canEdit ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={`/connect-dots/manage/${puzzle.id}`}
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
                    <form
                      action={unpinAction}
                      className="flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input name="puzzleId" type="hidden" value={puzzle.id} />
                      <input name="visible" type="hidden" value="false" />
                      <button type="submit">
                        <TrashIcon className="h-5 w-5 text-red-600" />
                      </button>
                    </form>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{puzzle.unpinLabel ?? 'Eemalda koduvaatest'}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>

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
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setItems(puzzles)
  }, [puzzles])

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canManage) return

    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newItems = arrayMove(items, oldIndex, newIndex)
    setItems(newItems)

    startTransition(async () => {
      await onReorder(newItems.map((item) => item.id))
    })
  }

  if (!mounted) {
    return (
      <ul className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {items.map((puzzle) => (
          <SortablePuzzleCard
            key={puzzle.id}
            canManage={false}
            isAdmin={isAdmin}
            puzzle={puzzle}
            unpinAction={unpinAction}
          />
        ))}
      </ul>
    )
  }

  return (
    <>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {items.map((puzzle) => (
              <SortablePuzzleCard
                key={puzzle.id}
                canManage={canManage}
                isAdmin={isAdmin}
                puzzle={puzzle}
                unpinAction={unpinAction}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {isPending && <p className="mt-2 text-xs text-muted-foreground">Salvestan järjekorda…</p>}
    </>
  )
}
