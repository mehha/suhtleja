import type { CSSProperties } from 'react'

import { LABEL_CASE_CLASS, type LabelCase } from '@/utilities/labelCase'
import { cn } from '@/utilities/ui'

// A board cell's label, in the board and in its editor. It never breaks a word, since a child
// learning to read needs whole words: the font shrinks until the longest word fits the cell
// (`.board-cell-label` in globals.css works it out from the cell's width and this word's length).
// The letters are the member's choice (`letterCase`, users.labelCase): capitals by default.
//
// `alone` is a card without a picture: the word is all the card shows, so it sits in the middle of
// the card and grows to fill it (up to 32px, not 20px). Under a picture the word sat at the bottom;
// without one it was left at the top of an empty card. The label then takes the card's free height
// and also sizes the text by it, one line for each word, so a card of several words stays inside.
export function CellLabel({
  title,
  className,
  letterCase = 'upper',
  alone = false,
}: {
  title: string
  className?: string
  letterCase?: LabelCase
  alone?: boolean
}) {
  const words = title.split(/\s+/).filter(Boolean)
  const longestWord = Math.max(1, ...words.map((word) => [...word].length))

  return (
    <div
      className={cn(
        // -mx-1 reaches into the cell's padding: a long word gets the cell's full width (to 4px
        // from its border) before it has to shrink.
        'board-cell-label -mx-1 text-center text-slate-950',
        alone ? 'board-cell-label-alone flex min-h-0 flex-1 items-center justify-center' : 'shrink-0 pb-1',
        className,
      )}
    >
      <div
        className={cn(
          'board-cell-label-text break-words font-semibold',
          alone && 'w-full',
          LABEL_CASE_CLASS[letterCase],
        )}
        style={{ '--label-chars': longestWord, '--label-lines': Math.max(1, words.length) } as CSSProperties}
      >
        {title}
      </div>
    </div>
  )
}
