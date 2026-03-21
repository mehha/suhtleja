'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Grid2X2, Trash } from 'lucide-react'

type ToolbarProps = {
  onAddCellAction: () => void
  onAddBlockAction: (rows: number, cols: number) => void
  onClearAction: () => void
  disableClear: boolean
}

const MIN_DIMENSION = 1
const MAX_DIMENSION = 12
const BLOCK_PRESETS = [
  { label: '1×6', rows: '1', cols: '6' },
  { label: '2×2', rows: '2', cols: '2' },
  { label: '2×6', rows: '2', cols: '6' },
  { label: '3×3', rows: '3', cols: '3' },
  { label: '3×4', rows: '3', cols: '4' },
]

function parseDimension(value: string) {
  if (!/^\d+$/.test(value)) return null

  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed)) return null
  if (parsed < MIN_DIMENSION || parsed > MAX_DIMENSION) return null

  return parsed
}

export function BoardEditorToolbar({
  onAddCellAction,
  onAddBlockAction,
  onClearAction,
  disableClear,
}: ToolbarProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [rowsValue, setRowsValue] = useState('2')
  const [colsValue, setColsValue] = useState('2')

  const parsedRows = parseDimension(rowsValue)
  const parsedCols = parseDimension(colsValue)
  const canSubmit = useMemo(() => parsedRows !== null && parsedCols !== null, [parsedCols, parsedRows])

  const resetDialog = () => {
    setRowsValue('2')
    setColsValue('2')
  }

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      resetDialog()
    }
  }

  const handleAddBlock = () => {
    if (parsedRows === null || parsedCols === null) return

    onAddBlockAction(parsedRows, parsedCols)
    setDialogOpen(false)
    resetDialog()
  }

  const applyPreset = (rows: string, cols: string) => {
    setRowsValue(rows)
    setColsValue(cols)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="xs" type="button" onClick={onAddCellAction}>
        + Lisa üks ruut
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="xs" type="button" className="relative pr-6">
            Lisa plokk <Grid2X2 width={14} className="absolute right-2 top-1/2 -translate-y-1/2" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Lisa plokk</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex flex-wrap gap-2">
              {BLOCK_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => applyPreset(preset.rows, preset.cols)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="board-block-rows">Read</Label>
              <Input
                id="board-block-rows"
                type="number"
                inputMode="numeric"
                min={MIN_DIMENSION}
                max={MAX_DIMENSION}
                step={1}
                value={rowsValue}
                onChange={(event) => setRowsValue(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="board-block-cols">Veerge</Label>
              <Input
                id="board-block-cols"
                type="number"
                inputMode="numeric"
                min={MIN_DIMENSION}
                max={MAX_DIMENSION}
                step={1}
                value={colsValue}
                onChange={(event) => setColsValue(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">Lubatud vahemik: 1 kuni 12 rida ja veergu.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Tühista
            </Button>
            <Button type="button" onClick={handleAddBlock} disabled={!canSubmit}>
              Lisa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        title="Kustuta kõik kastid"
        type="button"
        size="xs"
        variant="destructive"
        onClick={onClearAction}
        disabled={disableClear}
      >
        <Trash width={14} />
      </Button>
    </div>
  )
}
