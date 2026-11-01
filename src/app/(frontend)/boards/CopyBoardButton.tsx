'use client'

import { Copy } from 'lucide-react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { copyBoard } from './actions'

type CopyBoardButtonProps = {
  boardId: number
  // Where a failed copy returns to.
  returnTo: string
  // A button (a shared board's page) or a link-like action in a list row (Koduhaldus).
  variant?: 'button' | 'inline'
  boardName?: string
}

function SubmitButton({ variant, boardName }: Pick<CopyBoardButtonProps, 'variant' | 'boardName'>) {
  // Disabled while the copy is made, so a second tap doesn't make two.
  const { pending } = useFormStatus()
  const label = pending ? 'Teen koopiat…' : variant === 'button' ? 'Tee endale koopia' : 'Tee koopia'

  if (variant === 'button') {
    return (
      <Button type="submit" variant="outline" className="gap-2" disabled={pending}>
        <Copy className="h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
    )
  }
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={boardName ? `Tee koopia: ${boardName}` : undefined}
      className="inline-flex items-center gap-1 py-1.5 underline-offset-2 hover:underline disabled:opacity-60"
    >
      <Copy className="h-3 w-3" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

/** "Tee endale koopia": makes the member's own copy of the board and opens it in the editor. */
export function CopyBoardButton({ boardId, returnTo, variant = 'inline', boardName }: CopyBoardButtonProps) {
  return (
    <form action={copyBoard} className="inline-flex">
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton variant={variant} boardName={boardName} />
    </form>
  )
}
