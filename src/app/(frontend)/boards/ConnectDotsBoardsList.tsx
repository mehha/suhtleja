'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PlusCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FLASH_TOASTS, type ActionResult } from '@/utilities/flashToast'
import { ActionSwitch } from './ActionSwitch'
import { EditButton, ListGroup, ListRow, ListSearch, OthersToggle, RowMenu } from './KoduhaldusList'

export type ConnectDotsBoardsPuzzle = {
  enabled?: boolean | null
  homeVisible: boolean
  id: number | string
  isOwnedByCurrentUser: boolean
  owner?: {
    email?: null | string
    id?: number | string
    name?: null | string
    role?: null | string
  } | null
  pinned?: boolean | null
  title?: null | string
  updatedAt?: null | string
  visibleToAllUsers?: boolean | null
}

type Props = {
  deletePuzzle: (formData: FormData) => Promise<void>
  isAdmin: boolean
  puzzles: ConnectDotsBoardsPuzzle[]
  togglePinned: (formData: FormData) => Promise<ActionResult>
  // The admin's other users' private games: how many, and whether they were loaded (null for members).
  others: { count: number; shown: boolean } | null
}

// Who made it, for the admin.
function creatorLabel(owner: ConnectDotsBoardsPuzzle['owner']) {
  if (!owner) return '-'
  if (owner.role === 'admin') return 'Admin'
  return [owner.name, owner.email].filter(Boolean).join(' · ') || '-'
}

export function ConnectDotsBoardsList({ deletePuzzle, isAdmin, others, puzzles, togglePinned }: Props) {
  const [query, setQuery] = useState('')

  const filteredPuzzles = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim()
    if (!normalizedQuery) return puzzles

    return puzzles.filter((puzzle) => {
      const title = puzzle.title?.toLowerCase() ?? ''
      const ownerName =
        isAdmin && puzzle.owner ? `${puzzle.owner.name ?? ''} ${puzzle.owner.email ?? ''}`.toLowerCase() : ''

      return title.includes(normalizedQuery) || ownerName.includes(normalizedQuery)
    })
  }, [isAdmin, puzzles, query])

  const row = (puzzle: ConnectDotsBoardsPuzzle) => {
    const puzzleName = puzzle.title || 'Nimetu mäng'
    const isOwn = puzzle.isOwnedByCurrentUser
    const canManagePuzzle = isAdmin || isOwn

    return (
      <ListRow
        key={puzzle.id}
        name={puzzleName}
        href={`/connect-dots?puzzle=${puzzle.id}`}
        badges={
          <>
            {puzzle.visibleToAllUsers && (!isOwn || isAdmin) ? <Badge variant="secondary">Jagatud</Badge> : null}
            {/* Off in the game editor ("Nähtav /connect-dots lehel"): not shown to the child. */}
            {puzzle.enabled === false ? <Badge variant="outline">Peidetud</Badge> : null}
          </>
        }
        // The game's type, as on the home and in the editor (connect-dots.md).
        subtitle={isAdmin ? `Ühenda punktid · Looja: ${creatorLabel(puzzle.owner)}` : 'Ühenda punktid'}
        controls={
          <div className="sm:w-40">
            <ActionSwitch
              action={togglePinned}
              ariaLabel={`Näita koduvaates: ${puzzleName}`}
              checked={puzzle.homeVisible}
              fields={{ puzzleId: String(puzzle.id) }}
              name="pinned"
              stateLabels={{ on: 'Koduvaates', off: 'Pole koduvaates' }}
              successMessages={{
                on: FLASH_TOASTS['game-pinned'].message,
                off: FLASH_TOASTS['game-unpinned'].message,
              }}
              toastId="game-home"
            />
          </div>
        }
        actions={
          canManagePuzzle ? (
            <>
              <EditButton href={`/connect-dots/manage/${puzzle.id}`} name={puzzleName} />
              <RowMenu
                name={puzzleName}
                remove={{ action: deletePuzzle, fields: { puzzleId: String(puzzle.id) }, kind: 'mäng' }}
              />
            </>
          ) : null
        }
      />
    )
  }

  const mine = filteredPuzzles.filter((puzzle) => puzzle.isOwnedByCurrentUser)
  const shared = filteredPuzzles.filter((puzzle) => !puzzle.isOwnedByCurrentUser && puzzle.visibleToAllUsers)
  // Only an admin gets other users' private games.
  const othersRows = filteredPuzzles.filter((puzzle) => !puzzle.isOwnedByCurrentUser && !puzzle.visibleToAllUsers)
  const searching = query.trim().length > 0

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Mängud</h2>
          <p className="text-sm text-muted-foreground">Halda siin mänge ja vali, millised neist on lapse koduvaates.</p>
        </div>

        <Button asChild className="gap-2">
          <Link href="/connect-dots/manage/new">
            <PlusCircle className="h-4 w-4" />
            Lisa mäng
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <ListSearch count={puzzles.length} label="Otsi mänge" onChange={setQuery} value={query} />

        {searching && !filteredPuzzles.length ? (
          <p className="text-sm text-muted-foreground">Otsingule ei vasta ükski mäng.</p>
        ) : null}

        <ListGroup
          title="Minu mängud"
          empty={searching ? undefined : 'Sul pole veel oma mänge. Lisa üks nupust „Lisa mäng“.'}
        >
          {mine.map(row)}
        </ListGroup>

        <ListGroup title="Jagatud mängud" description="Valmis mängud kõigile. Muuta neid ei saa.">
          {shared.map(row)}
        </ListGroup>

        {others && others.count > 0 ? (
          <ListGroup
            title={`Teiste kasutajate mängud (${others.count})`}
            description={
              others.shown ? 'Privaatsed mängud.' : 'Privaatsed mängud. Need laaditakse alles siis, kui avad need.'
            }
            action={<OthersToggle label="teiste kasutajate mängud" shown={others.shown} />}
            collapsed={!others.shown}
          >
            {othersRows.map(row)}
          </ListGroup>
        ) : null}
      </div>
    </section>
  )
}
