'use client'

import { Smile, UserLock } from 'lucide-react'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import { switchToChildModeAction } from '@/app/(frontend)/kodu/modeActions'
import { ParentUnlockDialog } from '@/app/(frontend)/kodu/ParentUnlockDialog'
import { cn } from '@/utilities/ui'

type ParentModeToggleProps = {
  isParentMode?: boolean
  hasPin: boolean
}

const buttonClassName =
  'inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:gap-2 sm:px-4 [&_svg]:h-[18px] [&_svg]:w-[18px]'

// One labelled button for the view you can switch to. In the parent view, handing the device to the
// child is the main action, so it gets the filled navy button; the child view's way back asks for
// the PIN. Phones under 380px wide show the short label, so the header still fits; the full label
// stays for screen readers, so the button's name doesn't change with the width.
export function ParentModeToggle({ isParentMode, hasPin }: ParentModeToggleProps) {
  const pathname = usePathname()

  if (isParentMode) {
    return (
      <form action={switchToChildModeAction} data-navigation-form>
        <input name="returnTo" type="hidden" value={pathname} />
        <button
          type="submit"
          className={cn(
            buttonClassName,
            'bg-[#22314c] text-white hover:bg-[#172238] focus-visible:ring-[#22314c]',
          )}
        >
          <Smile aria-hidden="true" />
          <span className="max-[379px]:sr-only">Lapse vaade</span>
          <span aria-hidden="true" className="min-[380px]:hidden">
            Laps
          </span>
        </button>
      </form>
    )
  }

  return (
    <ParentUnlockDialog
      hasPin={hasPin}
      className={cn(
        buttonClassName,
        'border border-slate-300 bg-white text-slate-800 hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring',
      )}
    >
      <UserLock aria-hidden="true" />
      <span className="max-[379px]:sr-only">Vanema vaade</span>
      <span aria-hidden="true" className="min-[380px]:hidden">
        Vanem
      </span>
    </ParentUnlockDialog>
  )
}
