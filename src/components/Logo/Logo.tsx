import clsx from 'clsx'
import React from 'react'

interface Props {
  className?: string
  /** Folds the wordmark away under the tiles (the scrolled header). */
  compact?: boolean
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (props: Props) => {
  const { className, compact = false } = props

  return (
    <div className={clsx('inline-flex select-none flex-col items-center leading-none', className)}>
      <div className="flex items-end gap-1">
        <span className="relative flex h-10 w-10 rotate-[-2deg] items-center justify-center overflow-hidden rounded-[9px] bg-gradient-to-br from-[#ffbb2e] via-[#ff980d] to-[#ec6c05] shadow-[0_7px_16px_rgba(236,108,5,0.32)]">
          <span className="absolute inset-[6px] rounded-full bg-white shadow-inner shadow-black/10" />
          <span className="absolute left-[3px] top-[3px] h-2 w-2 rounded-full bg-white/45 blur-[0.5px]" />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="relative z-10 h-5 w-5 text-[#ef8a10]"
            aria-hidden="true"
          >
            <circle cx="8" cy="10" r="1.4" fill="currentColor" />
            <circle cx="16" cy="10" r="1.4" fill="currentColor" />
            <path
              d="M7.25 14.2C8.45 16.1 10.08 17 12 17C13.92 17 15.55 16.1 16.75 14.2"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
        </span>

        <span className="relative flex h-10 w-10 rotate-[2deg] items-center justify-center overflow-hidden rounded-[9px] bg-gradient-to-br from-[#ff7668] via-[#ef4035] to-[#bf1f2b] shadow-[0_7px_16px_rgba(191,31,43,0.28)]">
          <span className="absolute left-[3px] top-[3px] h-2 w-2 rounded-full bg-white/35 blur-[0.5px]" />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="relative z-10 h-7 w-7 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.16)]"
            aria-hidden="true"
          >
            <path d="M12.001 4.52853C14.35 2.42 17.98 2.49 20.2426 4.75736C22.5053 7.02472 22.583 10.637 20.4786 12.993L11.9999 21.485L3.52138 12.993C1.41705 10.637 1.49571 7.01901 3.75736 4.75736C6.02157 2.49315 9.64519 2.41687 12.001 4.52853Z" />
          </svg>
        </span>

        <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[9px] bg-gradient-to-br from-[#29a1f7] via-[#1c79dd] to-[#1359b7] shadow-[0_7px_16px_rgba(19,89,183,0.3)] after:absolute after:-bottom-1 after:left-[7px] after:h-3 after:w-3 after:rotate-45 after:rounded-[2px] after:bg-[#1359b7]">
          <span className="absolute left-[3px] top-[3px] h-2 w-2 rounded-full bg-white/35 blur-[0.5px]" />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="relative z-10 h-7 w-7 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.16)]"
            aria-hidden="true"
          >
            <path d="M20 20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V11L1 11L11.3273 1.6115C11.7087 1.26475 12.2913 1.26475 12.6727 1.6115L23 11L20 11V20ZM12 15C13.3807 15 14.5 13.8807 14.5 12.5C14.5 11.1193 13.3807 9.99998 12 9.99998C10.6193 9.99998 9.5 11.1193 9.5 12.5C9.5 13.8807 10.6193 15 12 15Z" />
          </svg>
        </span>
      </div>

      {/* The wordmark's row folds from 1fr to 0fr. The clip lets the "j" descender hang below the row. */}
      <span
        className={clsx(
          'grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none',
          compact ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
      >
        <span className="min-h-0 [clip-path:inset(-1em_-1em_-0.3em_-1em)]">
          <span
            className={clsx(
              'block whitespace-nowrap pt-1.5 text-[1.38rem] font-bold tracking-[-0.025em] text-[#22314c] transition-[opacity,transform,filter] ease-out [text-shadow:0_1px_0_rgba(255,255,255,0.4)] motion-reduce:transition-none sm:text-[1.58rem]',
              compact
                ? '-translate-y-2 scale-90 opacity-0 blur-[2px] duration-200'
                : 'translate-y-0 scale-100 opacity-100 blur-0 delay-75 duration-300',
            )}
          >
            Suhtleja.ee
          </span>
        </span>
      </span>
    </div>
  )
}
