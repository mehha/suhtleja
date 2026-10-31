'use client'

import Link from 'next/link'

import { LogoTile } from '@/components/Brand'
import { LogoHouse } from '@/components/Logo/Logo'
import { ParentModeToggle } from '@/Header/Nav/ParentModeToggle'
import { cn } from '@/utilities/ui'

type ChildModeBarProps = {
  hasPin: boolean
  /** On the child's home itself: the Kodu button stays in place, marked as the current page. */
  current?: boolean
  /** The board's or game's name, shown in the middle from the sm breakpoint. */
  title?: string | null
}

// Like a board cell: the logo's blue house tile and the word, large enough for a child's finger.
const homeClassName =
  'inline-flex h-14 shrink-0 items-center gap-2.5 justify-self-start rounded-2xl bg-white py-1 pl-1 pr-4 text-lg font-bold uppercase tracking-wide text-slate-950 shadow-md'

// The child view hides the site header, so the child's pages (home, a board, a game) show this bar
// instead: the Kodu button, always in the same place, and the parent view's PIN button. The bar
// sticks to the top on the page's own (opaque) background, so a long board scrolls under it
// instead of under floating buttons, and no faded cards show through. The negative margins undo
// the page shell's padding (`FrontendShell`).
export function ChildModeBar({ hasPin, current = false, title }: ChildModeBarProps) {
  const home = (
    <>
      <LogoTile index={2}>
        <LogoHouse className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.16)]" />
      </LogoTile>
      Kodu
    </>
  )

  return (
    <div className="sticky top-0 z-40 -mx-3 -mt-3 mb-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-gray-50 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      {current ? (
        <h1 aria-current="page" className={cn(homeClassName, 'ring-2 ring-[#1c79dd]')}>
          {home}
        </h1>
      ) : (
        <Link
          href="/kodu"
          className={cn(
            homeClassName,
            'ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1c79dd] active:scale-[0.97]',
          )}
        >
          {home}
        </Link>
      )}

      {title ? (
        <p className="hidden truncate text-center text-base font-semibold text-slate-600 sm:block">
          {title}
        </p>
      ) : (
        <span />
      )}

      <div className="justify-self-end">
        <ParentModeToggle hasPin={hasPin} />
      </div>
    </div>
  )
}
