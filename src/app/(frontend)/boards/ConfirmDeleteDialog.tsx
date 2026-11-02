'use client'

import { useFormStatus } from 'react-dom'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export type DeleteTarget = {
  // The server action that deletes it (Koduhaldus), and the fields it reads.
  action: (formData: FormData) => Promise<void>
  fields: Record<string, string>
  kind: 'tahvel' | 'mäng'
}

type ConfirmDeleteDialogProps = DeleteTarget & {
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DeleteSubmit() {
  // Disabled while it is deleted; the list then loses the row, and the dialog with it.
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? 'Kustutan…' : 'Kustuta'}
    </Button>
  )
}

/** Asks before a Koduhaldus row's board or game is deleted for good (its "…" menu opens it). */
export function ConfirmDeleteDialog({ action, fields, kind, name, open, onOpenChange }: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{kind === 'tahvel' ? 'Kustuta tahvel?' : 'Kustuta mäng?'}</AlertDialogTitle>
          <AlertDialogDescription>
            „{name}“ kustutatakse jäädavalt. Seda ei saa tagasi võtta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action}>
          {Object.entries(fields).map(([field, value]) => (
            <input key={field} type="hidden" name={field} value={value} />
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel>Loobu</AlertDialogCancel>
            <DeleteSubmit />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
