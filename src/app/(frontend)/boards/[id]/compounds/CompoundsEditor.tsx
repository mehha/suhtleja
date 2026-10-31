'use client'

import { Fragment, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight, Plus, Trash2, Volume2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import { prepareTextForTTS } from '@/utilities/azureTTS'
import type { ActionResult } from '@/utilities/flashToast'
import { cn } from '@/utilities/ui'
import { useUnsavedChangesGuard } from '@/utilities/useUnsavedChangesGuard'
import type { Compound } from './applyCompounds'
import { CardChip, CardPicker, cardLabel, type BoardCard } from './CardPicker'
import {
  COMPOUND_MISSING_CELL,
  COMPOUND_MISSING_WORD,
  COMPOUND_TOO_SHORT,
  findCompoundsProblem,
  getCompoundProblem,
} from './validateCompounds'

export type { BoardCard }

type CompoundsEditorProps = {
  boardId: string
  initialCompounds: Compound[] | null | undefined
  // The board's cards in reading order.
  cards: BoardCard[]
  // With AI on, the board doesn't use compounds.
  aiEnabled: boolean
  onSave: (boardId: string, compounds: Compound[]) => Promise<ActionResult>
}

// Which card picker is open: for a new compound, a card added to one, or a card swapped in one.
type Picker =
  | { mode: 'new' }
  | { mode: 'add'; compoundId: string }
  | { mode: 'replace'; compoundId: string; position: number }

// The search appears once the list is long enough to need it.
const SEARCH_FROM = 9

const PROBLEM_BADGES: Record<string, string> = {
  [COMPOUND_TOO_SHORT]: 'Liiga vähe kaarte',
  [COMPOUND_MISSING_CELL]: 'Kaart puudub',
  [COMPOUND_MISSING_WORD]: 'Sõna puudub',
}

// One word for every card, and a speech form only where it differs from the word: an empty one
// says the word, so the speech follows the word while it's edited.
function normalizeCompound(compound: Compound): Compound {
  const cells = (compound.cells ?? []).map(({ cellId }) => ({ cellId }))
  const parts = cells.map((_, i) => {
    const surface = compound.parts?.[i]?.surface ?? ''
    const tts = compound.parts?.[i]?.tts ?? ''
    return { surface, tts: tts.trim() === surface.trim() ? '' : tts }
  })
  return { id: compound.id, cells, parts }
}

const wordsOf = (compound: Compound) =>
  (compound.parts ?? [])
    .map((part) => (part.surface ?? '').trim())
    .filter(Boolean)
    .join(' ')

const speechOf = (compound: Compound) =>
  (compound.parts ?? [])
    .map((part) => (part.tts ?? '').trim() || (part.surface ?? '').trim())
    .filter(Boolean)
    .join(' ')

const newCompoundId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `compound-${Date.now()}`

// Runs once React has rendered a state change (an opened compound, say).
const afterRender = (run: () => void) => window.setTimeout(run, 0)

const scrollToCompound = (id: string) =>
  afterRender(() =>
    document
      .getElementById(`compound-${id}`)
      ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }),
  )

export function CompoundsEditor({
  boardId,
  initialCompounds,
  cards,
  aiEnabled,
  onSave,
}: CompoundsEditorProps) {
  const [isPending, startTransition] = useTransition()
  const [compounds, setCompounds] = useState<Compound[]>(() =>
    (initialCompounds ?? []).map(normalizeCompound),
  )
  // The last saved state: leaving with anything else asks first.
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(compounds))
  const dirty = JSON.stringify(compounds) !== savedJson
  const [openId, setOpenId] = useState('')
  const [picker, setPicker] = useState<Picker | null>(null)
  // Compounds whose speech is spelled differently from their words show the speech fields.
  const [pronunciationIds, setPronunciationIds] = useState(
    () =>
      new Set(
        compounds
          .filter((compound) => compound.parts?.some((part) => part.tts?.trim()))
          .map((compound) => compound.id),
      ),
  )
  // Problems show at their fields once a save has failed on them.
  const [showErrors, setShowErrors] = useState(false)
  const [filter, setFilter] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const titleOf = (cardId: string) => cardById.get(cardId)?.title ?? ''

  const {
    dialogOpen: leaveDialogOpen,
    setDialogOpen: setLeaveDialogOpen,
    confirmNavigation: confirmLeave,
  } = useUnsavedChangesGuard({ enabled: dirty })

  const updateCompound = (id: string, change: (compound: Compound) => Compound) =>
    setCompounds((prev) =>
      prev.map((compound) => (compound.id === id ? change(compound) : compound)),
    )

  const handlePick = (cardIds: string[]) => {
    if (!picker) return

    if (picker.mode === 'new') {
      const id = newCompoundId()
      setCompounds((prev) => [
        ...prev,
        {
          id,
          cells: cardIds.map((cellId) => ({ cellId })),
          parts: cardIds.map((cellId) => ({ surface: titleOf(cellId), tts: '' })),
        },
      ])
      setOpenId(id)
      setFilter('')
      scrollToCompound(id)
    } else if (picker.mode === 'add') {
      const [cellId] = cardIds
      updateCompound(picker.compoundId, (compound) => ({
        ...compound,
        cells: [...(compound.cells ?? []), { cellId }],
        parts: [...(compound.parts ?? []), { surface: titleOf(cellId), tts: '' }],
      }))
    } else {
      const { position } = picker
      const [cellId] = cardIds
      updateCompound(picker.compoundId, (compound) => {
        const oldTitle = titleOf(compound.cells?.[position]?.cellId ?? '')
        const word = (compound.parts?.[position]?.surface ?? '').trim()
        // The old card's own word follows the new card; a word the parent wrote stays.
        const keepWord = word !== '' && word !== oldTitle
        return {
          ...compound,
          cells: (compound.cells ?? []).map((cell, i) => (i === position ? { cellId } : cell)),
          parts: (compound.parts ?? []).map((part, i) =>
            i === position && !keepWord ? { surface: titleOf(cellId), tts: '' } : part,
          ),
        }
      })
    }

    setPicker(null)
  }

  const removeCard = (id: string, position: number) =>
    updateCompound(id, (compound) => ({
      ...compound,
      cells: (compound.cells ?? []).filter((_, i) => i !== position),
      parts: (compound.parts ?? []).filter((_, i) => i !== position),
    }))

  const setPart = (id: string, position: number, key: 'surface' | 'tts', value: string) =>
    updateCompound(id, (compound) => ({
      ...compound,
      parts: (compound.parts ?? []).map((part, i) =>
        i === position ? { ...part, [key]: value } : part,
      ),
    }))

  const setPronunciation = (id: string, on: boolean) => {
    setPronunciationIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
    // Off: the speech follows the words again.
    if (!on) {
      updateCompound(id, (compound) => ({
        ...compound,
        parts: (compound.parts ?? []).map((part) => ({ ...part, tts: '' })),
      }))
    }
  }

  const removeCompound = (removed: Compound) => {
    const index = compounds.findIndex((compound) => compound.id === removed.id)
    setCompounds((prev) => prev.filter((compound) => compound.id !== removed.id))
    toast('Sõnaühend kustutatud.', {
      id: 'compound-removed',
      action: {
        label: 'Võta tagasi',
        onClick: () =>
          setCompounds((prev) =>
            prev.some((compound) => compound.id === removed.id)
              ? prev
              : [...prev.slice(0, index), removed, ...prev.slice(index)],
          ),
      },
    })
  }

  // Says the whole compound the way the board will.
  const play = async (compound: Compound) => {
    const text = speechOf(compound)
    if (!text) return

    audioRef.current?.pause()
    setPlayingId(compound.id)

    try {
      const response = await fetch('/next/tts-ms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prepareTextForTTS(text) }),
      })
      if (!response.ok) throw new Error(`Speech failed: ${response.status}`)

      const url = URL.createObjectURL(await response.blob())
      const audio = new Audio(url)
      audioRef.current = audio

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve()
        // Another Kuula stops this one.
        audio.onpause = () => resolve()
        audio.onerror = () => reject(new Error('Playback failed'))
        audio.play().catch(reject)
      }).finally(() => URL.revokeObjectURL(url))
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        toast.error('Heli ei õnnestunud. Proovi uuesti.', { id: 'compound-speech' })
      }
    } finally {
      setPlayingId((current) => (current === compound.id ? null : current))
    }
  }

  const save = () => {
    const problem = findCompoundsProblem(compounds)

    if (problem) {
      // Open the first compound that needs fixing and put the cursor in its empty word.
      const first = compounds.find((compound) => getCompoundProblem(compound))!
      setShowErrors(true)
      setFilter('')
      setOpenId(first.id)
      scrollToCompound(first.id)
      afterRender(() =>
        document
          .getElementById(`compound-${first.id}`)
          ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
          ?.focus(),
      )
      toast.error(problem, { id: 'compounds-save' })
      return
    }

    const toSave = compounds

    // The transition stays pending until the save returns, so the button can't save twice.
    startTransition(async () => {
      let result: ActionResult
      try {
        result = await onSave(boardId, toSave)
      } catch (error) {
        console.error(error)
        result = { ok: false, error: 'Salvestamine ebaõnnestus. Proovi uuesti.' }
      }

      if (!result.ok) {
        toast.error(result.error, { id: 'compounds-save' })
        return
      }

      setSavedJson(JSON.stringify(toSave))
      setShowErrors(false)
      toast.success('Sõnaühendid salvestatud.', { id: 'compounds-save' })
    })
  }

  const visibleCompounds = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return compounds

    return compounds.filter((compound) =>
      [
        wordsOf(compound),
        ...(compound.cells ?? []).map(({ cellId }) => cardLabel(cardById.get(cellId))),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [compounds, filter, cardById])

  const editLink = (
    <Link href={`/boards/${boardId}/edit`} className="font-medium underline underline-offset-2">
      tahvli muutmise lehel
    </Link>
  )

  const renderCompound = (compound: Compound) => {
    const cells = compound.cells ?? []
    const parts = compound.parts ?? []
    const words = wordsOf(compound)
    const labels = cells.map(({ cellId }) => cardLabel(cardById.get(cellId)))
    const problem = getCompoundProblem(compound)
    const hasRemovedCard = cells.some(({ cellId }) => !cardById.has(cellId))
    const showPronunciation = pronunciationIds.has(compound.id)
    const badge = hasRemovedCard ? 'Kaart on kustutatud' : problem ? PROBLEM_BADGES[problem] : null

    return (
      <AccordionItem
        key={compound.id}
        value={compound.id}
        id={`compound-${compound.id}`}
        className={cn(
          'scroll-mb-28 rounded-2xl border bg-card shadow-sm',
          showErrors && problem && 'border-red-300',
        )}
      >
        <div className="flex items-center gap-1 pr-2">
          {/* min-w-0 down to the chips lets a long compound wrap instead of widening the page. */}
          <div className="min-w-0 flex-1">
            <AccordionTrigger className="min-w-0 gap-3 px-3 py-3 text-left hover:no-underline sm:px-4">
              <span className="sr-only">{`${labels.join(' + ')}: ${words || 'sõnad puuduvad'}`}</span>
              <span
                className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-3"
                aria-hidden="true"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-1">
                  {cells.map(({ cellId }, i) => (
                    <Fragment key={i}>
                      {i > 0 && <span className="text-slate-400">+</span>}
                      <CardChip card={cardById.get(cellId)} />
                    </Fragment>
                  ))}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <ArrowRight className="size-4 shrink-0 text-slate-400" />
                  <span className="truncate text-base font-semibold text-slate-950">
                    {words || '…'}
                  </span>
                </span>
              </span>
              {badge && (
                <Badge variant="destructive" className="shrink-0 whitespace-nowrap">
                  {badge}
                </Badge>
              )}
            </AccordionTrigger>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => void play(compound)}
            disabled={!words}
            aria-label={`Kuula: ${speechOf(compound) || 'sõnad puuduvad'}`}
          >
            {playingId === compound.id ? (
              <Spinner className="size-5" />
            ) : (
              <Volume2 className="size-5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => removeCompound(compound)}
            aria-label={`Kustuta sõnaühend ${words || labels.join(' + ')}`}
          >
            <Trash2 className="size-5 text-red-600" />
          </Button>
        </div>

        <AccordionContent className="px-3 sm:px-4">
          {hasRemovedCard && (
            <p className="mb-3 text-sm text-red-700">
              Üks kaart on tahvlilt kustutatud, nii et see sõnaühend ei saa enam sobida. Vali selle
              asemele teine kaart või kustuta sõnaühend.
            </p>
          )}
          {showErrors && problem && (
            <p className="mb-3 text-sm font-medium text-red-700">{problem}</p>
          )}

          <ol className="flex flex-col gap-2">
            {cells.map(({ cellId }, position) => {
              const card = cardById.get(cellId)
              const part = parts[position] ?? { surface: '', tts: '' }
              const fieldId = `compound-${compound.id}-${position}`
              const wordMissing = showErrors && !(part.surface ?? '').trim()

              return (
                <li
                  key={position}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]"
                >
                  <div className="col-span-2 flex min-w-0 flex-col gap-1 md:col-span-1">
                    <span className="text-xs font-medium text-slate-500">
                      {position + 1}. kaart
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPicker({ mode: 'replace', compoundId: compound.id, position })
                      }
                      aria-label={`${position + 1}. kaart: ${cardLabel(card)}. Vali teine kaart`}
                      className={cn(
                        'flex h-11 min-w-0 items-center gap-2 rounded-xl border bg-white pl-1 pr-3 text-left transition-colors hover:border-[#ff980d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff980d]',
                        !card && 'border-dashed border-red-300',
                      )}
                    >
                      <CardChip card={card} className="h-10 border-0 bg-transparent" />
                      <span className="ml-auto shrink-0 text-xs text-slate-500">Muuda</span>
                    </button>
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor={`${fieldId}-word`}
                        className="text-xs font-medium text-slate-500"
                      >
                        Sõna
                      </Label>
                      <Input
                        id={`${fieldId}-word`}
                        value={part.surface ?? ''}
                        onChange={(event) =>
                          setPart(compound.id, position, 'surface', event.target.value)
                        }
                        placeholder={card?.title || undefined}
                        aria-invalid={wordMissing || undefined}
                        className={cn(
                          'h-11 bg-white',
                          wordMissing && 'border-red-500 ring-1 ring-red-500',
                        )}
                      />
                    </div>
                    {showPronunciation && (
                      <div className="flex flex-col gap-1">
                        <Label
                          htmlFor={`${fieldId}-speech`}
                          className="text-xs font-medium text-slate-500"
                        >
                          Hääldus
                        </Label>
                        <Input
                          id={`${fieldId}-speech`}
                          value={part.tts ?? ''}
                          onChange={(event) =>
                            setPart(compound.id, position, 'tts', event.target.value)
                          }
                          placeholder={part.surface || undefined}
                          className="h-11 bg-white"
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    // Level with the word field, below its label.
                    className="mt-5"
                    onClick={() => removeCard(compound.id, position)}
                    disabled={cells.length <= 2}
                    title={cells.length <= 2 ? 'Sõnaühendis on vähemalt kaks kaarti' : undefined}
                    aria-label={`Eemalda ${position + 1}. kaart`}
                  >
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </li>
              )
            })}
          </ol>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pb-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!cards.length}
              onClick={() => setPicker({ mode: 'add', compoundId: compound.id })}
            >
              <Plus className="size-4" aria-hidden="true" />
              Lisa kaart
            </Button>
            <div className="flex items-center gap-2">
              <Switch
                id={`compound-${compound.id}-pronunciation`}
                checked={showPronunciation}
                onCheckedChange={(on) => setPronunciation(compound.id, on)}
              />
              <Label htmlFor={`compound-${compound.id}-pronunciation`} className="text-sm">
                Hääldus erineb kirjapildist
              </Label>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    )
  }

  const pickerCompound =
    picker && picker.mode !== 'new'
      ? compounds.find((compound) => compound.id === picker.compoundId)
      : undefined

  return (
    <div className="flex flex-col gap-4">
      {aiEnabled && (
        <p
          role="note"
          className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200"
        >
          Selle tahvli AI on sees, seega sõnaühendeid praegu ei kasutata. AI saab välja lülitada{' '}
          {editLink}.
        </p>
      )}
      {cards.length === 0 && (
        <p
          role="note"
          className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200"
        >
          Tahvlil pole veel kaarte. Lisa need {editLink}, siis saad neist sõnaühendeid teha.
        </p>
      )}

      {compounds.length >= SEARCH_FROM && (
        <Input
          type="search"
          aria-label="Otsi sõnaühendit"
          placeholder="Otsi sõnaühendit…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="max-w-xs"
        />
      )}

      {compounds.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 px-6 py-10 text-center">
          <p className="font-semibold">Sõnaühendeid pole veel.</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Vali kaardid selles järjekorras, nagu laps neid vajutab, ja kirjuta, kuidas sõnad koos
            kõlavad.
          </p>
          {cards.length > 0 && (
            <Button type="button" className="gap-1.5" onClick={() => setPicker({ mode: 'new' })}>
              <Plus className="size-4" aria-hidden="true" />
              Lisa esimene sõnaühend
            </Button>
          )}
        </div>
      ) : visibleCompounds.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sellist sõnaühendit pole.</p>
      ) : (
        <Accordion
          type="single"
          collapsible
          value={openId}
          onValueChange={setOpenId}
          className="flex flex-col gap-2"
        >
          {visibleCompounds.map(renderCompound)}
        </Accordion>
      )}

      {/* Save stays in reach at the bottom of the screen, however long the list. An empty list
          has nothing to save until the last compound is deleted. */}
      {(compounds.length > 0 || dirty) && (
        <div className="sticky bottom-3 z-20 mt-2 rounded-2xl border bg-white/95 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600" aria-live="polite">
              {isPending ? 'Salvestan…' : dirty ? 'Salvestamata muudatused' : 'Kõik on salvestatud'}
            </p>
            <div className="flex flex-wrap gap-2">
              {compounds.length > 0 && cards.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setPicker({ mode: 'new' })}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Lisa sõnaühend
                </Button>
              )}
              <Button type="button" onClick={save} disabled={!dirty || isPending}>
                {isPending ? (
                  <>
                    <Spinner className="mr-2" />
                    Salvestan…
                  </>
                ) : dirty ? (
                  'Salvesta'
                ) : (
                  'Salvestatud'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {picker && (
        <CardPicker
          open
          onOpenChange={(open) => !open && setPicker(null)}
          cards={cards}
          mode={picker.mode === 'new' ? 'sequence' : 'single'}
          title={
            picker.mode === 'new'
              ? 'Uus sõnaühend'
              : picker.mode === 'add'
                ? 'Lisa kaart'
                : 'Vali kaart'
          }
          description={
            picker.mode === 'new'
              ? 'Vajuta kaarte selles järjekorras, nagu laps neid vajutab.'
              : picker.mode === 'add'
                ? 'Vajuta kaarti, mille laps vajutab sõnaühendi lõpus.'
                : 'Vajuta kaarti, mille laps vajutab selles kohas.'
          }
          selectedId={
            picker.mode === 'replace' ? pickerCompound?.cells?.[picker.position]?.cellId : undefined
          }
          onPick={handlePick}
        />
      )}

      <UnsavedChangesDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        onConfirm={confirmLeave}
      />
    </div>
  )
}
