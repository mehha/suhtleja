'use client'

import Image from 'next/image'
import { Fragment, useMemo, useState } from 'react'
import { Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/utilities/ui'
import { CellLabel } from '../CellLabel'
import { isSvgImageURL } from '@/utilities/symbolProxy'
import { openWithoutKeyboardOnTouch } from '@/utilities/touchScreen'

// A card on the board, as the compounds page shows it.
export type BoardCard = {
  id: string
  title: string
  imageURL: string | null
}

// A compound may point to a card that was removed from the board since.
export const cardLabel = (card: BoardCard | undefined) =>
  card ? card.title || 'Tekstita kaart' : 'Kustutatud kaart'

// A card's picture and word in one line: in a compound's header and its rows.
export function CardChip({ card, className }: { card: BoardCard | undefined; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-lg border bg-white px-2 text-sm font-semibold uppercase text-slate-900',
        card?.imageURL && 'pl-1',
        !card && 'border-dashed border-red-300 bg-red-50 normal-case text-red-700',
        className,
      )}
    >
      {card?.imageURL && (
        <span className="relative size-7 shrink-0" aria-hidden="true">
          <Image
            src={card.imageURL}
            alt=""
            fill
            sizes="28px"
            className="object-contain"
            unoptimized={isSvgImageURL(card.imageURL)}
          />
        </span>
      )}
      <span className="truncate">{cardLabel(card)}</span>
    </span>
  )
}

type CardPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cards: BoardCard[]
  // 'sequence': the cards are tapped in the order the child taps them, and confirmed together.
  // 'single': one tap picks a card.
  mode: 'sequence' | 'single'
  title: string
  description: string
  selectedId?: string
  onPick: (cardIds: string[]) => void
}

const SEARCH_FROM = 13

// The board's cards with their pictures, to pick from the way the child sees them.
export function CardPicker({
  open,
  onOpenChange,
  cards,
  mode,
  title,
  description,
  selectedId,
  onPick,
}: CardPickerProps) {
  const [sequence, setSequence] = useState<string[]>([])
  const [query, setQuery] = useState('')

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const visibleCards = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? cards.filter((card) => card.title.toLowerCase().includes(q)) : cards
  }, [cards, query])

  const tap = (card: BoardCard) => {
    if (mode === 'single') {
      onPick([card.id])
      return
    }
    setSequence((prev) => [...prev, card.id])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The parent mostly taps cards: on a touch screen the search doesn't bring up the keyboard as
          the dialog opens, which would cover most of the cards (touchScreen.ts). */}
      <DialogContent
        className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-4 rounded-2xl p-4 sm:p-6"
        onOpenAutoFocus={openWithoutKeyboardOnTouch}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {mode === 'sequence' && (
          <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
            <p className="sr-only" aria-live="polite">
              {sequence.length
                ? `Valitud: ${sequence.map((id) => cardLabel(cardById.get(id))).join(', ')}`
                : 'Ühtegi kaarti pole veel valitud.'}
            </p>
            {sequence.length === 0 ? (
              <span className="px-1 text-sm text-slate-500" aria-hidden="true">
                Valitud kaardid tulevad siia.
              </span>
            ) : (
              <span
                className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
                aria-hidden="true"
              >
                {sequence.map((id, index) => (
                  <Fragment key={index}>
                    {index > 0 && <span className="text-slate-400">+</span>}
                    <CardChip card={cardById.get(id)} />
                  </Fragment>
                ))}
              </span>
            )}
            {sequence.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto gap-1.5"
                onClick={() => setSequence((prev) => prev.slice(0, -1))}
              >
                <Undo2 className="size-4" aria-hidden="true" />
                Võta tagasi
              </Button>
            )}
          </div>
        )}

        {cards.length >= SEARCH_FROM && (
          <Input
            type="search"
            aria-label="Otsi kaarti"
            placeholder="Otsi kaarti…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-1">
          {visibleCards.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sellist kaarti pole.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {visibleCards.map((card) => {
                const positions = sequence.flatMap((id, index) =>
                  id === card.id ? [index + 1] : [],
                )
                const isSelected = mode === 'single' ? card.id === selectedId : positions.length > 0

                return (
                  <li key={card.id}>
                    <button
                      type="button"
                      onClick={() => tap(card)}
                      aria-label={cardLabel(card)}
                      aria-pressed={mode === 'single' ? card.id === selectedId : undefined}
                      className={cn(
                        'relative flex aspect-square w-full flex-col overflow-hidden rounded-xl border-2 bg-white p-1.5 shadow-sm transition-colors hover:border-[#ff980d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff980d] focus-visible:ring-offset-2',
                        isSelected
                          ? 'border-[#ff980d] ring-2 ring-[#ff980d]/40'
                          : 'border-slate-200',
                      )}
                    >
                      {card.imageURL && (
                        <span className="relative min-h-0 w-full flex-1">
                          <Image
                            src={card.imageURL}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 33vw, 120px"
                            className="object-contain"
                          />
                        </span>
                      )}
                      <CellLabel
                        title={cardLabel(card)}
                        className={cn('pb-0', !card.imageURL && 'my-auto')}
                      />
                      {positions.length > 0 && (
                        <span
                          className="absolute right-1 top-1 rounded-full bg-[#ff980d] px-1.5 text-xs font-bold leading-5 text-white"
                          aria-hidden="true"
                        >
                          {positions.join(', ')}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {mode === 'sequence' && (
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Tühista
            </Button>
            <Button type="button" disabled={sequence.length < 2} onClick={() => onPick(sequence)}>
              {sequence.length < 2 ? 'Vali vähemalt kaks kaarti' : 'Lisa sõnaühend'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
