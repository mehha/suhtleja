'use client'

import Link from 'next/link'
import { Home, UserLock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ParentUnlockDialog } from './ParentUnlockDialog'

// The child view hides the site header, so full-screen child pages (a board, a game) show these
// two buttons instead: back to the child's home, and the parent PIN dialog.
export function ChildModeBar({ hasPin }: { hasPin: boolean }) {
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <Button
        asChild
        variant="secondary"
        size="icon"
        roundness="full"
        className="bg-white/90 shadow-lg ring-1 ring-gray-900/10 backdrop-blur"
      >
        <Link href="/kodu" aria-label="Kodu">
          <Home className="h-5 w-5" />
        </Link>
      </Button>

      <ParentUnlockDialog
        hasPin={hasPin}
        className="bg-white/90 shadow-lg ring-1 ring-gray-900/10 backdrop-blur"
      >
        <UserLock className="h-5 w-5" />
        <span className="sr-only">Vanema vaade</span>
      </ParentUnlockDialog>
    </div>
  )
}
