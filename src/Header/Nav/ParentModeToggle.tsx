'use client'

import { Baby, Smile } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { switchToChildModeAction } from '@/app/(frontend)/home/modeActions'
import { ParentUnlockDialog } from '@/app/(frontend)/home/ParentUnlockDialog'
import { ButtonGroup } from '@/components/ui/button-group'

type ParentModeToggleProps = {
  isParentMode?: boolean
  hasPin: boolean
}

export function ParentModeToggle({ isParentMode, hasPin }: ParentModeToggleProps) {
  const inParentMode = Boolean(isParentMode)

  return (
    <ButtonGroup
      className="inline-flex rounded-full border border-border bg-muted/70 text-xs font-medium shadow-sm"
    >
      {/* Lapse vaade */}
      {inParentMode ? (
        // vanema vaates -> Lapse nupp on klikitav (switchToChildModeAction)
        <form action={switchToChildModeAction} data-navigation-form>
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="rounded-full rounded-r-none border-none text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Smile className="mr-1 h-3.5 w-3.5" />
            <span className="hidden sm:inline-block">Laps</span>
          </Button>
        </form>
      ) : (
        // lapse vaates -> Lapse nupp on aktiivne (accent, disabled)
        <Button
          type="button"
          variant="default"
          size="icon"
          disabled
          className="rounded-full rounded-r-none bg-accent text-accent-foreground hover:bg-accent disabled:opacity-100"
        >
          <Smile className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline-block">Laps</span>
        </Button>
      )}

      {/* Vanema vaade */}
      {inParentMode ? (
        // vanema vaates -> Vanema nupp on aktiivne (accent, disabled)
        <Button
          type="button"
          variant="default"
          disabled
          size="icon"
          className="rounded-full rounded-l-none bg-accent text-accent-foreground hover:bg-accent disabled:opacity-100"
        >
          <Baby className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline-block">Vanem</span>
        </Button>
      ) : (
        // lapse vaates -> Vanema nupp on klikitav (avatakse PIN dialog)
        <ParentUnlockDialog
          hasPin={hasPin}
          className="rounded-full rounded-l-none border-none text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Baby className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline-block">Vanem</span>
        </ParentUnlockDialog>
      )}
    </ButtonGroup>
  )
}
