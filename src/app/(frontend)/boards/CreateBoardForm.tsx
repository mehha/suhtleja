'use client'

import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { LayoutGrid, PlusCircle } from 'lucide-react'

import { createStarterBoards } from './actions'

type CreateBoardFormProps = {
  createBoard: (formData: FormData) => Promise<void>
}

function StarterSubmitButton() {
  // Disabled while the boards are made, so a second tap doesn't make another set.
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" className="w-full gap-2" disabled={pending}>
      <LayoutGrid className="h-4 w-4" aria-hidden="true" />
      {pending ? 'Loon tahvleid…' : 'Loo alustuskomplekt'}
    </Button>
  )
}

export function CreateBoardForm({ createBoard }: CreateBoardFormProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const canSubmit = useMemo(() => name.trim().length > 0, [name])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setName('')
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Lisa tahvel
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lisa tahvel</DialogTitle>
          <DialogDescription>
            Sisesta tahvli nimi, et see luua.
          </DialogDescription>
        </DialogHeader>

        <form action={createBoard} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="new-board-name">Nimi</Label>
            <Input
              id="new-board-name"
              name="name"
              placeholder="Nt Kodu"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Loobu
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              Lisa tahvel
            </Button>
          </DialogFooter>
        </form>

        {/* The starter set (docs/rules/project/boards.md, "Starter set"). */}
        <form action={createStarterBoards} className="space-y-3 border-t pt-4">
          <input type="hidden" name="returnTo" value={pathname} />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Või alusta valmis tahvlitega</h3>
            <p className="text-sm text-muted-foreground">
              Põhisõnad tulevad koduvaatesse ja avavad tahvlid Söök ja jook, Mängimine, Tunded ning
              Kohad. Kaartidel on pildipanga pildid ja kõiki tahvleid saad hiljem muuta.
            </p>
          </div>
          <StarterSubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  )
}
