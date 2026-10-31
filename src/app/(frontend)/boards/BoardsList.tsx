'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Board } from '@/payload-types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Edit3,
  Monitor,
  Trash2,
} from 'lucide-react'
import { FLASH_TOASTS, type ActionResult } from '@/utilities/flashToast'
import { ActionSwitch } from './ActionSwitch'

type BoardsListOwner = { email?: string | null; name?: string | null; role?: string | null }

// Only what the list shows; /koduhaldus loads these fields and nothing else.
export type BoardsListBoard = Pick<Board, 'id' | 'name' | 'visibleToAllUsers'> & {
  homeVisible: boolean
  isOwnedByCurrentUser: boolean
  owner?: BoardsListOwner | number | null
}

type BoardsListProps = {
  boards: BoardsListBoard[]
  isAdmin: boolean
  toggleVisibility: (formData: FormData) => Promise<ActionResult>
  togglePinned: (formData: FormData) => Promise<ActionResult> // server action (/koduhaldus/page.tsx)
  deleteBoard: (formData: FormData) => Promise<void> // server action (/koduhaldus/page.tsx)
}

function renderCreator(owner: BoardsListOwner | null) {
  if (!owner) {
    return <span className="text-xs text-muted-foreground">-</span>
  }

  if (owner.role === 'admin') {
    return <span className="text-xs font-medium">Admin</span>
  }

  return (
    <div className="flex flex-col">
      {owner.name ? <span className="text-xs font-medium">{owner.name}</span> : null}
      {owner.email ? <span className="text-xs text-muted-foreground">{owner.email}</span> : null}
      {!owner.name && !owner.email ? <span className="text-xs text-muted-foreground">-</span> : null}
    </div>
  )
}

export function BoardsList({
  boards,
  isAdmin,
  toggleVisibility,
  togglePinned,
  deleteBoard,
}: BoardsListProps) {
  const [query, setQuery] = useState('')

  const filteredBoards = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return boards

    return boards.filter((board) => {
      const name = board.name?.toLowerCase() ?? ''
      const ownerName =
        typeof board.owner === 'object' && board.owner
          ? (board.owner.name || board.owner.email || '').toLowerCase()
          : ''
      return name.includes(q) || ownerName.includes(q)
    })
  }, [boards, query])

  if (!boards.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Sul pole veel ühtegi tahvlit. Lisa ülal paremal nupust “Lisa tahvel”.
      </p>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center flex-wrap justify-between gap-4">
          <div className="flex-1">
            <Input
              type="search"
              placeholder="Otsi tahvleid nime või omaniku järgi…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            Kokku <span className="font-medium">{boards.length}</span> tahvlit
            {filteredBoards.length !== boards.length && (
              <>
                {' · '}filtris{' '}
                <span className="font-medium">{filteredBoards.length}</span>
              </>
            )}
          </div>
        </div>

        <div className="w-full overflow-x-auto rounded-xl border bg-background">
          <Table className="min-w-max text-sm">
            <TableHeader className="bg-muted/60">
              <TableRow className="border-b">
                <TableHead className="w-10 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  #
                </TableHead>
                <TableHead className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Nimi
                </TableHead>
                <TableHead className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Looja
                </TableHead>
                <TableHead className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Koduvaade
                </TableHead>
                <TableHead className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Nähtavus
                </TableHead>
                <TableHead className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Koduhaldus
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredBoards.map((board, index) => {
                const isPinned = !!board.homeVisible
                const owner = typeof board.owner === 'object' && board.owner ? board.owner : null
                const boardName = board.name || 'Nimetu tahvel'
                const canEditBoard = board.isOwnedByCurrentUser
                // Admins also see other users' private boards; their home pin belongs to the owner.
                const canTogglePinned = board.isOwnedByCurrentUser || !!board.visibleToAllUsers

                return (
                  <TableRow
                    key={board.id}
                    className="border-b last:border-b-0 hover:bg-muted/40"
                  >
                    <TableCell className="px-3 py-2 align-middle text-xs text-muted-foreground">
                      {index + 1}
                    </TableCell>

                    <TableCell className="px-3 py-2 align-middle">
                      <div className="flex flex-col gap-0.5">
                        {/* The links are at least 24px tall, so a finger finds them on a tablet. */}
                        <Link
                          href={`/boards/${board.id}`}
                          className="inline-block py-0.5 font-medium underline-offset-2 hover:underline"
                        >
                          {boardName}
                        </Link>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Link
                            href={`/boards/${board.id}`}
                            className="inline-flex items-center gap-1 py-1.5 underline-offset-2 hover:underline"
                          >
                            <Monitor className="h-3 w-3" />
                            <span>Vaata</span>
                          </Link>
                          {canEditBoard ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <Link
                                href={`/boards/${board.id}/edit`}
                                className="inline-flex items-center gap-1 py-1.5 underline-offset-2 hover:underline"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Muuda</span>
                              </Link>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="px-3 py-2 align-middle">
                      {renderCreator(owner)}
                    </TableCell>

                    <TableCell className="px-3 py-2 align-middle">
                      <ActionSwitch
                        action={togglePinned}
                        ariaLabel={`Näita koduvaates: ${boardName}`}
                        checked={isPinned}
                        disabled={!canTogglePinned}
                        fields={{ boardId: String(board.id) }}
                        name="pinned"
                        stateLabels={{ on: 'Koduvaates', off: 'Peidetud' }}
                        successMessages={{
                          on: FLASH_TOASTS['board-pinned'].message,
                          off: FLASH_TOASTS['board-unpinned'].message,
                        }}
                        toastId="board-home"
                      />
                    </TableCell>

                    <TableCell className="px-3 py-2 align-middle">
                      {isAdmin ? (
                        <ActionSwitch
                          action={toggleVisibility}
                          ariaLabel={`Nähtav kõigile: ${boardName}`}
                          checked={!!board.visibleToAllUsers}
                          fields={{ boardId: String(board.id) }}
                          name="visibleToAllUsers"
                          stateLabels={{ on: 'Kõigile nähtav', off: 'Ainult omanikule' }}
                          successMessages={{
                            on: FLASH_TOASTS['board-shared'].message,
                            off: FLASH_TOASTS['board-unshared'].message,
                          }}
                          toastId="board-shared"
                        />
                      ) : (
                        <Badge
                          variant={board.visibleToAllUsers ? 'secondary' : 'outline'}
                          className="px-2 py-0.5 text-[11px]"
                        >
                          {board.visibleToAllUsers ? 'Kõigile nähtav' : 'Ainult omanikule'}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="px-3 py-2 align-middle text-right">
                      {canEditBoard ? (
                        <form
                          action={deleteBoard}
                          onSubmit={(e) => {
                            if (
                              !window.confirm(`Kas soovid kindlasti kustutada tahvli “${boardName}”?`)
                            ) {
                              e.preventDefault()
                            }
                          }}
                          className="inline-flex"
                        >
                          <input type="hidden" name="boardId" value={board.id} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="submit"
                                size="icon"
                                variant="ghost"
                                aria-label="Kustuta tahvel"
                                className="h-7 w-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Kustuta tahvel</p>
                            </TooltipContent>
                          </Tooltip>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">Ainult vaade</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  )
}
