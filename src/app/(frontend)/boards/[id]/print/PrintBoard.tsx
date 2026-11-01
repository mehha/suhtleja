'use client'

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Board, Media } from '@/payload-types'
import type { LabelCase } from '@/utilities/labelCase'
import { wordClassColor } from '@/utilities/wordClass'
import { CellLabel } from '../CellLabel'

type Props = {
  board: Board
  letterCase: LabelCase
}

const imageOf = (cell: NonNullable<NonNullable<Board['grid']>['cells']>[number]) =>
  cell.externalImageURL || (cell.image && typeof cell.image === 'object' && (cell.image as Media).url) || ''

// The board as the parent made it: its columns, each card at its place and size, its picture and
// word, its word class as the border (printed in colour: print-color-adjust). A4 landscape fits a
// board's width; a long board runs on to the next page.
export function PrintBoard({ board, letterCase }: Props) {
  const cols = Math.max(1, board.grid?.cols ?? 6)
  const cells = (board.grid?.cells ?? []).filter((cell) => !cell.locked)
  const name = board.name || 'Nimetu tahvel'
  const colours = board.extra?.wordClassColors !== false

  return (
    <div className="mx-auto max-w-6xl">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-11 w-11">
            <Link href={`/boards/${board.id}`} aria-label={`Tagasi: ${name}`}>
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
          <p className="text-sm text-slate-600">Prindi rõhtpaigutuses (A4). Lehe nupud ja menüü paberile ei lähe.</p>
        </div>
        <Button type="button" className="gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          Prindi
        </Button>
      </div>

      <h1 className="mb-4 text-2xl font-semibold print:mb-2 print:text-lg">{name}</h1>

      <div
        data-testid="print-grid"
        className="grid gap-3 [print-color-adjust:exact] print:gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cells.map((cell) => {
          const src = imageOf(cell)
          const colour = colours ? wordClassColor(cell.wordClass) : null
          return (
            <div
              key={cell.id}
              data-testid="print-card"
              className={`flex flex-col overflow-hidden rounded-xl bg-white p-2 [break-inside:avoid] ${
                colour ? 'border-4' : 'border-2 border-slate-300'
              }`}
              style={{
                gridColumn: `${cell.x + 1} / span ${cell.w}`,
                gridRow: `${cell.y + 1} / span ${cell.h}`,
                aspectRatio: `${cell.w} / ${cell.h}`,
                ...(colour ? { borderColor: colour } : {}),
              }}
            >
              {src ? (
                <div className="relative min-h-0 w-full flex-1 p-1">
                  {/* A plain img: printing takes every picture at once, without lazy loading. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={cell.title ?? ''} className="h-full w-full object-contain" />
                </div>
              ) : null}
              {cell.title ? <CellLabel title={cell.title} letterCase={letterCase} /> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
