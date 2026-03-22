'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Globe2, Pencil, Pin, PinOff, PlusCircle, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
  togglePinned: (formData: FormData) => Promise<void>
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
            <h2 className="text-2xl font-semibold">Connect-dots puzzle&apos;id</h2>
            <p className="text-sm text-muted-foreground">
              Halda siin connect-dots mänge ja vali, kas need ilmuvad koduvaates eraldi sektsioonis.
            </p>
          </div>

          <Button asChild className="gap-2">
            <Link href="/connect-dots/manage/new">
              <PlusCircle className="h-4 w-4" />
              Lisa uus puzzle
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            className="max-w-xs"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Otsi puzzle&apos;it…"
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
                  <TableHead>Puzzle</TableHead>
                  <TableHead>Looja</TableHead>
                  <TableHead>Koduvaade</TableHead>
                  <TableHead>Nähtavus</TableHead>
                  <TableHead className="text-right">Koduhaldus</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredPuzzles.map((puzzle) => {
                  const isPinned = puzzle.homeVisible
                  const canManagePuzzle = isAdmin || puzzle.isOwnedByCurrentUser

                  return (
                    <TableRow key={puzzle.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{puzzle.title || 'Nimetu puzzle'}</span>
                            <Badge variant="outline">Connect Dots</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Link className="hover:underline" href={`/connect-dots?puzzle=${puzzle.id}`}>
                              Ava mäng
                            </Link>
                            {canManagePuzzle ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <Link className="hover:underline" href={`/connect-dots/manage/${puzzle.id}`}>
                                  Muuda
                                </Link>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>{renderCreator(puzzle.owner)}</TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={isPinned ? 'default' : 'outline'}>
                            {isPinned ? 'Koduvaates' : 'Peidetud'}
                          </Badge>
                          <form action={togglePinned}>
                            <input name="puzzleId" type="hidden" value={String(puzzle.id)} />
                            <input
                              name="isOwnedByCurrentUser"
                              type="hidden"
                              value={puzzle.isOwnedByCurrentUser ? 'true' : 'false'}
                            />
                            <input name="pinned" type="hidden" value={(!isPinned).toString()} />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button className="h-7 w-7" size="icon" type="submit" variant="ghost">
                                  {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{isPinned ? 'Eemalda koduvaatest' : 'Lisa koduvaatesse'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </form>
                        </div>
                      </TableCell>

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

                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          {canManagePuzzle ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button asChild size="icon" variant="ghost">
                                  <Link href={`/connect-dots/manage/${puzzle.id}`}>
                                    <Pencil className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Muuda puzzle&apos;it</TooltipContent>
                            </Tooltip>
                          ) : null}

                          {puzzle.visibleToAllUsers ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button disabled size="icon" type="button" variant="ghost">
                                    <Globe2 className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>See puzzle on juba kõigile nähtav</TooltipContent>
                            </Tooltip>
                          ) : null}

                          {canManagePuzzle ? (
                            <form
                              action={deletePuzzle}
                              className="inline-flex"
                              onSubmit={(event) => {
                                if (
                                  !window.confirm(
                                    `Kas soovid kindlasti kustutada puzzle'i "${puzzle.title || 'Nimetu puzzle'}"?`,
                                  )
                                ) {
                                  event.preventDefault()
                                }
                              }}
                            >
                              <input name="puzzleId" type="hidden" value={String(puzzle.id)} />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                    size="icon"
                                    type="submit"
                                    variant="ghost"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Kustuta puzzle</TooltipContent>
                              </Tooltip>
                            </form>
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
