'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Pencil, PlusCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FLASH_TOASTS, type ActionResult } from '@/utilities/flashToast'
import { ActionSwitch } from './ActionSwitch'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'

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
}

function renderCreator(owner: ConnectDotsBoardsPuzzle['owner']) {
  if (!owner) {
    return <span className="text-xs text-muted-foreground">-</span>
  }

  if (owner.role === 'admin') {
    return <span className="text-xs font-medium">Admin</span>
  }

  return (
    <div className="flex flex-col text-xs">
      {owner.name ? <span className="font-medium">{owner.name}</span> : null}
      {owner.email ? <span className="text-muted-foreground">{owner.email}</span> : null}
      {!owner.name && !owner.email ? <span className="text-muted-foreground">-</span> : null}
    </div>
  )
}

export function ConnectDotsBoardsList({ deletePuzzle, isAdmin, puzzles, togglePinned }: Props) {
  const [query, setQuery] = useState('')

  const filteredPuzzles = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim()
    if (!normalizedQuery) return puzzles

    return puzzles.filter((puzzle) => {
      const title = puzzle.title?.toLowerCase() ?? ''
      const ownerName =
        typeof puzzle.owner === 'object' && puzzle.owner
          ? `${puzzle.owner.name ?? ''} ${puzzle.owner.email ?? ''}`.toLowerCase()
          : ''

      return title.includes(normalizedQuery) || ownerName.includes(normalizedQuery)
    })
  }, [puzzles, query])

  return (
    <TooltipProvider>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Mängud</h2>
            <p className="text-sm text-muted-foreground">
              Halda siin mänge ja vali, millised neist on lapse koduvaates.
            </p>
          </div>

          <Button asChild className="gap-2">
            <Link href="/connect-dots/manage/new">
              <PlusCircle className="h-4 w-4" />
              Lisa mäng
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            className="max-w-xs"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Otsi mänge…"
            type="search"
            value={query}
          />

          <div className="text-xs text-muted-foreground">
            Kokku <span className="font-medium">{puzzles.length}</span>
            {filteredPuzzles.length !== puzzles.length ? (
              <>
                {' '}
                · filtris <span className="font-medium">{filteredPuzzles.length}</span>
              </>
            ) : null}
          </div>
        </div>

        {filteredPuzzles.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            Puzzle&apos;id veel ei ole. Lisa esimene ülevalt paremalt.
          </div>
        ) : (
          <div className="w-full overflow-x-auto rounded-xl border bg-background">
            <Table className="min-w-max text-sm">
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead>Mäng</TableHead>
                  {/* The creator and the sharing are for the admin, as in the boards' table. */}
                  {isAdmin && <TableHead>Looja</TableHead>}
                  <TableHead>Koduvaade</TableHead>
                  {isAdmin && <TableHead>Nähtavus</TableHead>}
                  <TableHead className="text-right">
                    <span className="sr-only">Toimingud</span>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredPuzzles.map((puzzle) => {
                  const isPinned = puzzle.homeVisible
                  const canManagePuzzle = isAdmin || puzzle.isOwnedByCurrentUser
                  const puzzleName = puzzle.title || 'Nimetu mäng'
                  const isShared = !puzzle.isOwnedByCurrentUser && !!puzzle.visibleToAllUsers

                  return (
                    <TableRow key={puzzle.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{puzzleName}</span>
                            <Badge variant="outline">Ühenda punktid</Badge>
                            {!isAdmin && isShared ? <Badge variant="secondary">Jagatud</Badge> : null}
                            {/* Off in the game editor ("Nähtav /connect-dots lehel"): not shown to the child. */}
                            {!isAdmin && puzzle.enabled === false ? <Badge variant="outline">Peidetud</Badge> : null}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {/* At least 24px tall, so a finger finds them on a tablet. */}
                            <Link className="py-1.5 hover:underline" href={`/connect-dots?puzzle=${puzzle.id}`}>
                              Ava mäng
                            </Link>
                            {canManagePuzzle ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <Link className="py-1.5 hover:underline" href={`/connect-dots/manage/${puzzle.id}`}>
                                  Muuda
                                </Link>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      {isAdmin && <TableCell>{renderCreator(puzzle.owner)}</TableCell>}

                      <TableCell>
                        <ActionSwitch
                          action={togglePinned}
                          ariaLabel={`Näita koduvaates: ${puzzleName}`}
                          checked={isPinned}
                          fields={{ puzzleId: String(puzzle.id) }}
                          name="pinned"
                          stateLabels={{ on: 'Koduvaates', off: 'Pole koduvaates' }}
                          successMessages={{
                            on: FLASH_TOASTS['game-pinned'].message,
                            off: FLASH_TOASTS['game-unpinned'].message,
                          }}
                          toastId="game-home"
                        />
                      </TableCell>

                      {isAdmin && (
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={puzzle.enabled ? 'default' : 'outline'}>
                              {puzzle.enabled ? 'Aktiivne' : 'Peidetud'}
                            </Badge>
                            <Badge variant={puzzle.visibleToAllUsers ? 'secondary' : 'outline'}>
                              {puzzle.visibleToAllUsers ? 'Kõigile nähtav' : 'Ainult omanikule'}
                            </Badge>
                          </div>
                        </TableCell>
                      )}

                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          {canManagePuzzle ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button asChild size="icon" variant="ghost">
                                  <Link aria-label={`Muuda mängu: ${puzzleName}`} href={`/connect-dots/manage/${puzzle.id}`}>
                                    <Pencil className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Muuda mängu</TooltipContent>
                            </Tooltip>
                          ) : null}

                          {canManagePuzzle ? (
                            <ConfirmDeleteButton
                              action={deletePuzzle}
                              fields={{ puzzleId: String(puzzle.id) }}
                              kind="mäng"
                              name={puzzleName}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">Ainult vaade</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </TooltipProvider>
  )
}
