import type { CSSProperties } from 'react'

import { LABEL_CASE_CLASS, type LabelCase } from '@/utilities/labelCase'
import { cn } from '@/utilities/ui'

// A board cell's label, in the board and in its editor. It never breaks a word, since a child
// learning to read needs whole words: the font shrinks until the longest word fits the cell
// (`.board-cell-label` in globals.css works it out from the cell's width and this word's length).
// The letters are the member's choice (`letterCase`, users.labelCase): capitals by default.
export function CellLabel({
  title,
  className,
  letterCase = 'upper',
}: {
  title: string
  className?: string
  letterCase?: LabelCase
}) {
  const longestWord = Math.max(1, ...title.split(/\s+/).map((word) => [...word].length))

  return (
    <div
      className={cn(
        // -mx-1 reaches into the cell's padding: a long word gets the cell's full width (to 4px
        // from its border) before it has to shrink.
        'board-cell-label -mx-1 shrink-0 pb-1 text-center text-slate-950',
        className,
      )}
    >
      <div
        className={cn('board-cell-label-text break-words font-semibold', LABEL_CASE_CLASS[letterCase])}
        style={{ '--label-chars': longestWord } as CSSProperties}
      >
        {title}
      </div>
    </div>
  )
}
