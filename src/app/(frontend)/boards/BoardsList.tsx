'use client'

import React, { useMemo, useState } from 'react'
import type { Board } from '@/payload-types'

import { Badge } from '@/components/ui/badge'
import { FLASH_TOASTS, type ActionResult } from '@/utilities/flashToast'
import { ActionSwitch } from './ActionSwitch'
import { CopyBoardButton } from './CopyBoardButton'
import { EditButton, ListGroup, ListRow, ListSearch, RowMenu } from './KoduhaldusList'

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

const ownerOf = (board: BoardsListBoard) => (typeof board.owner === 'object' && board.owner ? board.owner : null)

// Who made it, for the admin.
function creatorLabel(owner: BoardsListOwner | null) {
  if (!owner) return '-'
  if (owner.role === 'admin') return 'Admin'
  return [owner.name, owner.email].filter(Boolean).join(' · ') || '-'
}

export function BoardsList({ boards, isAdmin, toggleVisibility, togglePinned, deleteBoard }: BoardsListProps) {
  const [query, setQuery] = useState('')

  const filteredBoards = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return boards

    return boards.filter((board) => {
      const name = board.name?.toLowerCase() ?? ''
      const owner = ownerOf(board)
      const ownerName = isAdmin && owner ? `${owner.name ?? ''} ${owner.email ?? ''}`.toLowerCase() : ''
      return name.includes(q) || ownerName.includes(q)
    })
  }, [boards, isAdmin, query])

  const row = (board: BoardsListBoard) => {
    const boardName = board.name || 'Nimetu tahvel'
    const isOwn = board.isOwnedByCurrentUser
    const isShared = !!board.visibleToAllUsers
    // Admins also see other users' private boards; their home pin belongs to the owner.
    const canTogglePinned = isOwn || isShared

    return (
      <ListRow
        key={board.id}
        name={boardName}
        href={`/boards/${board.id}`}
        badges={
          !isOwn && isShared ? (
            <Badge variant="secondary" className="px-2 py-0.5 text-[11px]">
              Jagatud
            </Badge>
          ) : null
        }
        subtitle={isAdmin ? `Looja: ${creatorLabel(ownerOf(board))}` : null}
        controls={
          <>
            <div className="sm:w-40">
              <ActionSwitch
                action={togglePinned}
                ariaLabel={`Näita koduvaates: ${boardName}`}
                checked={board.homeVisible}
                disabled={!canTogglePinned}
                fields={{ boardId: String(board.id) }}
                name="pinned"
                stateLabels={{ on: 'Koduvaates', off: 'Pole koduvaates' }}
                successMessages={{
                  on: FLASH_TOASTS['board-pinned'].message,
                  off: FLASH_TOASTS['board-unpinned'].message,
                }}
                toastId="board-home"
              />
            </div>
            {isAdmin ? (
              <div className="sm:w-44">
                <ActionSwitch
                  action={toggleVisibility}
                  ariaLabel={`Nähtav kõigile: ${boardName}`}
                  checked={isShared}
                  fields={{ boardId: String(board.id) }}
                  name="visibleToAllUsers"
                  stateLabels={{ on: 'Kõigile nähtav', off: 'Ainult omanikule' }}
                  successMessages={{
                    on: FLASH_TOASTS['board-shared'].message,
                    off: FLASH_TOASTS['board-unshared'].message,
                  }}
                  toastId="board-shared"
                />
              </div>
            ) : null}
          </>
        }
        actions={
          isOwn ? (
            <>
              <EditButton href={`/boards/${board.id}/edit`} name={boardName} />
              <RowMenu
                name={boardName}
                copy={{ boardId: board.id, returnTo: '/koduhaldus' }}
                remove={{ action: deleteBoard, fields: { boardId: String(board.id) }, kind: 'tahvel' }}
              />
            </>
          ) : (
            // Not theirs to change: a copy of their own is.
            <CopyBoardButton boardId={board.id} boardName={boardName} returnTo="/koduhaldus" variant="button" />
          )
        }
      />
    )
  }

  const mine = filteredBoards.filter((board) => board.isOwnedByCurrentUser)
  const shared = filteredBoards.filter((board) => !board.isOwnedByCurrentUser && board.visibleToAllUsers)
  // Only an admin gets other users' private boards.
  const others = filteredBoards.filter((board) => !board.isOwnedByCurrentUser && !board.visibleToAllUsers)
  const searching = query.trim().length > 0

  return (
    <div className="space-y-6">
      <ListSearch count={boards.length} label="Otsi tahvleid" onChange={setQuery} value={query} />

      {searching && !filteredBoards.length ? (
        <p className="text-sm text-muted-foreground">Otsingule ei vasta ükski tahvel.</p>
      ) : null}

      <ListGroup
        title="Minu tahvlid"
        empty={
          searching
            ? undefined
            : 'Sul pole veel oma tahvleid. Lisa üks nupust „Lisa tahvel“, seal saad alustada ka valmis tahvlitega.'
        }
      >
        {mine.map(row)}
      </ListGroup>

      <ListGroup
        title="Jagatud tahvlid"
        description="Valmis tahvlid kõigile. Muuta neid ei saa, aga saad teha endale koopia ja seda muuta."
      >
        {shared.map(row)}
      </ListGroup>

      <ListGroup title="Teiste kasutajate tahvlid" description="Privaatsed tahvlid. Nende koduvaade on omaniku valik.">
        {others.map(row)}
      </ListGroup>
    </div>
  )
}
