'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type UnsavedChangesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onConfirm,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvestamata muudatused</DialogTitle>
          <DialogDescription>
            Sul on salvestamata muudatused. Kas soovid lahkuda ilma salvestamata?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Jää lehele
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Lahku ilma salvestamata
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
