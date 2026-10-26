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
import { toast } from 'sonner'

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

type TextCellImageMatch = {
  groqError?: string
  foundWithGroqTerm?: string
  preview: string
}

type AiSearchTermsResult = {
  error?: string
  terms: string[]
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

function normalizeFallbackKey(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, ' ').trim()
}

function normalizeSearchTerms(terms: string[]) {
  const seen = new Set<string>()
  const normalizedTerms: string[] = []

  for (const term of terms) {
    const normalized = normalizeFallbackKey(term)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    normalizedTerms.push(normalized)
  }

  return normalizedTerms
}

async function fetchFirstArasaacSymbol(base: string, query: string, options?: { locale?: string }) {
  const params = new URLSearchParams({
    q: query,
    source: 'arasaac',
    limit: '1',
  })

  if (options?.locale) {
    params.set('locale', options.locale)
  } else {
    params.set('preferLocal', 'true')
  }

  const res = await fetch(`${base}/next/symbols?${params.toString()}`, { credentials: 'include' })

  if (!res.ok) return ''

  const json = (await res.json()) as {
    items?: Array<{ preview?: string }>
  }
  const first = Array.isArray(json.items) ? json.items[0] : null

  return first && typeof first.preview === 'string' ? first.preview : ''
}

async function fetchAiArasaacSearchTerms(base: string, label: string): Promise<AiSearchTermsResult> {
  try {
    const res = await fetch(`${base}/next/groq`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'symbol-search-terms',
        token: label,
      }),
      signal: AbortSignal.timeout(6000),
    })

    const json = (await res.json().catch(() => ({}))) as {
      error?: unknown
      note?: unknown
      terms?: unknown
    }

    if (!res.ok) {
      return {
        error: typeof json.error === 'string' ? json.error : `HTTP ${res.status}`,
        terms: [],
      }
    }

    if (json.note === 'sdk_error') {
      return { error: 'sdk_error', terms: [] }
    }

    return {
      terms: Array.isArray(json.terms)
        ? json.terms.filter((term): term is string => typeof term === 'string')
        : [],
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'request_failed',
      terms: [],
    }
  }
}

async function findImageForTextCell(base: string, label: string): Promise<TextCellImageMatch | null> {
  const directPreview = await fetchFirstArasaacSymbol(base, label)
  if (directPreview) return { preview: directPreview }

  const aiTerms = await fetchAiArasaacSearchTerms(base, label)
  const fallbackTerms = normalizeSearchTerms(aiTerms.terms)

  for (const term of fallbackTerms) {
    const preview = await fetchFirstArasaacSymbol(base, term, { locale: 'en' })
    if (preview) return { foundWithGroqTerm: term, preview }
  }

  if (aiTerms.error) {
    return { groqError: aiTerms.error, preview: '' }
  }

  return null
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
            const imageMatch = await findImageForTextCell(base, line)
            return {
              groqError: imageMatch?.groqError,
              foundWithGroqTerm: imageMatch?.foundWithGroqTerm,
              title: line,
              externalImageURL: imageMatch?.preview ?? '',
            }
          } catch {
            return { title: line }
          }
        }),
      )

      const groqMatches = results.filter(
        (result) => typeof result.foundWithGroqTerm === 'string' && !!result.externalImageURL,
      )

      if (groqMatches.length > 0) {
        toast.info('AI leidis ARASAAC pildid', {
          closeButton: true,
          description: groqMatches
            .map((match) => `${match.title} -> ${match.foundWithGroqTerm ?? ''}`)
            .join(', '),
          duration: Number.POSITIVE_INFINITY,
        })
      }

      const groqErrors = results.filter(
        (result) => typeof result.groqError === 'string',
      )

      if (groqErrors.length > 0) {
        toast.error('AI sünonüümide otsing ei tööta', {
          closeButton: true,
          description: groqErrors
            .map((match) => `${match.title}: ${match.groqError ?? ''}`)
            .join(', '),
          duration: Number.POSITIVE_INFINITY,
        })
      }

      const withoutImage = results.filter((result) => !result.externalImageURL)

      if (withoutImage.length > 0) {
        toast.warning(`${withoutImage.length} sõnale ei leitud pilti.`, {
          description: `${withoutImage.map((result) => result.title).join(', ')}. Lisa pilt kaardi muutmise aknas.`,
        })
      }

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
        <DialogContent className="max-h-[min(90vh,720px)] overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lisa plokk</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[calc(min(90vh,720px)-9rem)] gap-4 overflow-y-auto py-2 pr-1">
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
                      Iga mitte-tühi rida loob ühe kaardi. Esimene ARASAAC pilt lisatakse automaatselt; vajadusel proovitakse AI abil ingliskeelseid otsisõnu.
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
