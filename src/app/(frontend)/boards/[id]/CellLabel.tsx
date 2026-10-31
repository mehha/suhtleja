import type { CSSProperties } from 'react'

import { cn } from '@/utilities/ui'

// A board cell's label, in the board and in its editor. It never breaks a word, since a child
// learning to read needs whole words: the font shrinks until the longest word fits the cell
// (`.board-cell-label` in globals.css works it out from the cell's width and this word's length).
export function CellLabel({ title, className }: { title: string; className?: string }) {
  const longestWord = Math.max(1, ...title.split(/\s+/).map((word) => [...word].length))

  return (
    <div
      className={cn(
        // -mx-1 reaches into the cell's padding: a long word gets the cell's full width (to 4px
        // from its border) before it has to shrink.
        'board-cell-label -mx-1 shrink-0 pb-1 text-center uppercase text-slate-950',
        className,
      )}
    >
      <div
        className="board-cell-label-text break-words font-semibold"
        style={{ '--label-chars': longestWord } as CSSProperties}
      >
        {title}
      </div>
    </div>
  )
}
