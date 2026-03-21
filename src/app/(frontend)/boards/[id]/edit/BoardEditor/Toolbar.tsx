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
import { Textarea } from '@/components/ui/textarea'
import { getClientSideURL } from '@/utilities/getURL'
import { Grid2X2, Trash } from 'lucide-react'

type ToolbarProps = {
  onAddCellAction: () => void
  onAddBlockAction: (rows: number, cols: number) => void
  onAddTextCellsAction: (
    items: Array<{
      externalImageURL?: string
      title: string
    }>,
  ) => void
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

function normalizeSentenceToken(token: string) {
  return token.replace(/^[.,!?;:"'()\[\]{}]+|[.,!?;:"'()\[\]{}]+$/g, '').trim()
}

function parseSentenceToItems(value: string) {
  return value
    .split(/\s+/)
    .map(normalizeSentenceToken)
    .filter(Boolean)
}

export function BoardEditorToolbar({
  onAddCellAction,
  onAddBlockAction,
  onAddTextCellsAction,
  onClearAction,
  disableClear,
}: ToolbarProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mode, setMode] = useState<'block' | 'text'>('block')
  const [textMode, setTextMode] = useState<'lines' | 'sentence'>('lines')
  const [rowsValue, setRowsValue] = useState('2')
  const [colsValue, setColsValue] = useState('2')
  const [textValue, setTextValue] = useState('')
  const [sentenceValue, setSentenceValue] = useState('')
  const [sentenceItems, setSentenceItems] = useState<string[]>([])
  const [addingTexts, setAddingTexts] = useState(false)

  const parsedRows = parseDimension(rowsValue)
  const parsedCols = parseDimension(colsValue)
  const parsedLines = useMemo(
    () =>
      textValue
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [textValue],
  )
  const normalizedSentenceItems = useMemo(
    () => sentenceItems.map((item) => item.trim()).filter(Boolean),
    [sentenceItems],
  )
  const canSubmit = useMemo(() => parsedRows !== null && parsedCols !== null, [parsedCols, parsedRows])
  const textItemsToAdd = textMode === 'lines' ? parsedLines : normalizedSentenceItems

  const resetDialog = () => {
    setMode('block')
    setTextMode('lines')
    setRowsValue('2')
    setColsValue('2')
    setTextValue('')
    setSentenceValue('')
    setSentenceItems([])
    setAddingTexts(false)
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

  const handleAddTextCells = async () => {
    if (!textItemsToAdd.length || addingTexts) return

    setAddingTexts(true)
    try {
      const base = getClientSideURL()
      const results = await Promise.all(
        textItemsToAdd.map(async (line) => {
          try {
            const res = await fetch(
              `${base}/next/symbols?q=${encodeURIComponent(line)}&source=arasaac&preferLocal=true&limit=1`,
              { credentials: 'include' },
            )

            if (!res.ok) {
              return { title: line }
            }

            const json = (await res.json()) as {
              items?: Array<{ preview?: string }>
            }
            const first = Array.isArray(json.items) ? json.items[0] : null

            return {
              title: line,
              externalImageURL:
                first && typeof first.preview === 'string' ? first.preview : '',
            }
          } catch {
            return { title: line }
          }
        }),
      )

      onAddTextCellsAction(results)
      setDialogOpen(false)
      resetDialog()
    } finally {
      setAddingTexts(false)
    }
  }

  const applyPreset = (rows: string, cols: string) => {
    setRowsValue(rows)
    setColsValue(cols)
  }

  const generateSentenceItems = () => {
    setSentenceItems(parseSentenceToItems(sentenceValue))
  }

  const updateSentenceItem = (index: number, value: string) => {
    setSentenceItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  const removeSentenceItem = (index: number) => {
    setSentenceItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lisa plokk</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="xs"
                variant={mode === 'block' ? 'default' : 'outline'}
                onClick={() => setMode('block')}
              >
                Mõõtude järgi
              </Button>
              <Button
                type="button"
                size="xs"
                variant={mode === 'text' ? 'default' : 'outline'}
                onClick={() => setMode('text')}
              >
                Teksti järgi
              </Button>
            </div>

            {mode === 'block' ? (
              <>
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
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant={textMode === 'lines' ? 'default' : 'outline'}
                    onClick={() => setTextMode('lines')}
                  >
                    Üks rida = üks kaart
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={textMode === 'sentence' ? 'default' : 'outline'}
                    onClick={() => setTextMode('sentence')}
                  >
                    Kleebi lause
                  </Button>
                </div>

                {textMode === 'lines' ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="board-bulk-text">Üks sõna või fraas rea kohta</Label>
                      <Textarea
                        id="board-bulk-text"
                        rows={8}
                        value={textValue}
                        onChange={(event) => setTextValue(event.target.value)}
                        placeholder={'koer\nkass\nmina tahan juua'}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Iga mitte-tühi rida loob ühe kaardi. Esimene ARASAAC pilt lisatakse automaatselt, kui leitakse vaste.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="board-sentence-text">Kleebi lause või sõnade jada</Label>
                      <Textarea
                        id="board-sentence-text"
                        rows={4}
                        value={sentenceValue}
                        onChange={(event) => setSentenceValue(event.target.value)}
                        placeholder="mina tahan juua vett"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Jagan teksti vaikimisi sõnade kaupa. Enne lisamist saad nimekirja muuta.
                      </p>
                      <Button type="button" size="xs" variant="outline" onClick={generateSentenceItems}>
                        Jaga eelvaatesse
                      </Button>
                    </div>
                    {sentenceItems.length > 0 ? (
                      <div className="grid gap-2 rounded-md border p-3">
                        <p className="text-sm font-medium">Loodavad kaardid</p>
                        <div className="grid gap-2">
                          {sentenceItems.map((item, index) => (
                            <div key={`${index}-${item}`} className="flex items-center gap-2">
                              <Input
                                value={item}
                                onChange={(event) => updateSentenceItem(index, event.target.value)}
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => removeSentenceItem(index)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Tühista
            </Button>
            {mode === 'block' ? (
              <Button type="button" onClick={handleAddBlock} disabled={!canSubmit}>
                Lisa
              </Button>
            ) : (
              <Button type="button" onClick={() => void handleAddTextCells()} disabled={!textItemsToAdd.length || addingTexts}>
                {addingTexts ? 'Lisan…' : 'Lisa kaardid'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        variant="destructive"
        size="xs"
        type="button"
        onClick={onClearAction}
        disabled={disableClear}
      >
        <Trash width={16} /> Kustuta kõik kastid
      </Button>
    </div>
  )
}
