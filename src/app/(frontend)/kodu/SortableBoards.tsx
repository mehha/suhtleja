'use client'

import React, { useEffect, useState, useTransition } from 'react'
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
  unpinAction: (formData: FormData) => Promise<void>
}

type SortableBoardCardProps = {
  board: HomeBoard
  canManage: boolean
  isAdmin?: boolean
  unpinAction: (formData: FormData) => Promise<void>
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
  unpinAction,
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
      className="relative border p-3 flex flex-col gap-3 aspect-[4/3] w-[280px] rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 cursor-pointer"
    >
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
            className="cursor-grab active:cursor-grabbing touch-none hover:bg-muted"
            aria-label="Muuda tahvli järjekorda"
          >
            <GripVertical className="w-5 h-5" />
          </button>
        ) : (
          <span className="w-5 h-5" aria-hidden="true" />
        )}

        {(canManage || board.canEdit) && (
          <div className="flex items-center gap-2">
            {isAdmin && <UserCog className="w-5 h-5" />}
            {board.isShared ? <Globe2 className="w-4 h-4 text-sky-600" /> : null}

            <TooltipProvider>
              {board.canEdit ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/boards/${board.id}/edit`}
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
                  <form
                    className="flex items-center"
                    action={unpinAction}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input type="hidden" name="boardId" value={board.id} />
                    <input type="hidden" name="visible" value="false" />
                    <button type="submit">
                      <TrashIcon className="w-5 h-5 text-red-600" />
                    </button>
                  </form>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{board.unpinLabel ?? 'Eemalda koduvaatest'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      <div className="relative w-full h-28 rounded-lg overflow-hidden flex items-center justify-center">
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
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
      await onReorder(newItems.map((item) => String(item.id)))
    })
  }

  if (!mounted) {
    return (
      <ul className="flex flex-wrap gap-4">
        {items.map((board) => (
          <SortableBoardCard
            key={board.id}
            board={board}
            canManage={false}
            isAdmin={isAdmin}
            unpinAction={unpinAction}
          />
        ))}
      </ul>
    )
  }

  return (
    <>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={items.map((item) => String(item.id))}
          strategy={rectSortingStrategy}
        >
          <ul className="flex flex-wrap gap-4">
            {items.map((board) => (
              <SortableBoardCard
                key={board.id}
                board={board}
                canManage={canManage}
                isAdmin={isAdmin}
                unpinAction={unpinAction}
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
