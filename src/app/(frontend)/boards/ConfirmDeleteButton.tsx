'use client'

import { Trash2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type ConfirmDeleteButtonProps = {
  // The server action that deletes it (Koduhaldus), and the fields it reads.
  action: (formData: FormData) => Promise<void>
  fields: Record<string, string>
  kind: 'tahvel' | 'mäng'
  name: string
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

/** The bin in a Koduhaldus row: asks in a dialog before it deletes the board or game for good. */
export function ConfirmDeleteButton({ action, fields, kind, name }: ConfirmDeleteButtonProps) {
  const label = kind === 'tahvel' ? 'Kustuta tahvel' : 'Kustuta mäng'

  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`${label}: ${name}`}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
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
