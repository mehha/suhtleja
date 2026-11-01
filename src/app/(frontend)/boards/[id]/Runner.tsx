// src/app/(frontend)/boards/[id]/Runner.tsx
'use client'

import { useState, useMemo, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import Image from 'next/image'
import type { Board, Media } from '@/payload-types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Edit3, FolderOpen, Printer, Trash, Undo2, Volume2Icon } from 'lucide-react'
import ReactGridLayout, { type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

// UUS: sõnaühendite util
import { applyCompounds, type SelectedToken } from './compounds/applyCompounds'
import { getCompoundFormForLastToken } from './compounds/getCompoundFormForLastToken'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { AnimatedVolumeIcon } from '@/components/Animations/AnimatedVolumeIcon'
import { getBoardTTSCacheManifest } from '@/utilities/boardTTSCacheManifest'
import { prepareTextForTTS } from '@/utilities/azureTTS'
import { ChildModeBar } from '@/app/(frontend)/kodu/ChildModeBar'
import { CellLabel } from './CellLabel'
import { LABEL_CASE_CLASS, type LabelCase } from '@/utilities/labelCase'
import { cn } from '@/utilities/ui'
import { CopyBoardButton } from '../CopyBoardButton'
import { toast } from 'sonner'
import { isSvgImageURL } from '@/utilities/symbolProxy'
import { wordClassColor } from '@/utilities/wordClass'
import type { GrammarToken } from '@/utilities/grammar/applyGrammar'
import { loadGrammar, useGrammar, type Grammar } from '@/utilities/grammar/useGrammar'

const GRID_MARGIN: [number, number] = [16, 16]
// The board keeps its own columns while a tile is at least this wide (the editor's minimum too), so
// a tablet shows the board as the parent made it, upright and sideways alike.
const MIN_TILE_WIDTH = 96

type RunnerProps = {
  board: Board
  isParentMode: boolean
  canEdit: boolean
  hasPin: boolean
  // The boards the cards open that the user can read, by id (page.tsx).
  linkedBoards?: Record<number, string>
  // The board a card opened this one from.
  backTo?: { id: number; name: string } | null
  // The member's voice and rate (profile page), or null for the site's voice at the normal rate.
  speech?: { voice: string; rate: string } | null
  // How the cards write their words (profile page).
  letterCase?: LabelCase
}

// A card that opens another board hands the sentence over to it, and the back button hands it back:
// the next board's runner takes it if it is addressed to it and fresh. Opening a board from the home
// starts with an empty sentence.
const PHRASE_HANDOFF_KEY = 'suhtleja:phrase'
const PHRASE_HANDOFF_MAX_AGE_MS = 60_000

function handPhraseOver(to: number, items: unknown[]) {
  try {
    sessionStorage.setItem(PHRASE_HANDOFF_KEY, JSON.stringify({ to, at: Date.now(), items }))
  } catch {
    // Without storage the next board starts with an empty sentence.
  }
}

// A tile with a word class keeps its colour on the border; its pressed and hover rings are the same
// colour, lighter (#rrggbbaa), since the orange ring of the other tiles is the colour of a thing.
const wordClassTileStyle = (color: string) =>
  ({ borderColor: color, '--tile-ring': `${color}73`, '--tile-ring-hover': `${color}59` }) as CSSProperties

type SequenceItem = {
  // Tells two taps of the same card apart, so an AI form that comes after the tap finds its word.
  key: number
  cellId: string
  text: string
  // The card's class and picture, for a word tapped on another board (whose cards this one hasn't).
  wordClass?: string | null
  image?: string
}

type MorphResponse = {
  surface?: string
}

// A card's picture: an external symbol or an uploaded picture.
function cellImageSrc(cell: any): string {
  return (
    cell?.externalImageURL ||
    (cell?.image && typeof cell.image === 'object' && (cell.image as Media).url) ||
    ''
  )
}

// play() rejects with AbortError when a newer tap interrupts it; that isn't a failure.
function isInterruptedPlayback(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

// Speech the board hasn't saved (a sentence, an AI-corrected word) is synthesized on demand and
// the last few are kept while the page is open: "play all" fetches its sentence while the child is
// still tapping, and a replay or an undo plays at once.
const SPOKEN_AUDIO_KEEP = 12
// The sentence is fetched once the child pauses, so a quick run of taps loads only the last one.
const SENTENCE_PREFETCH_DELAY_MS = 300
// Longer runs of taps are rarely played as one sentence; "play all" still fetches them on demand.
const SENTENCE_PREFETCH_MAX_WORDS = 10
// Word forms the next tap can need, loaded after each tap (a board's nouns after "tahan").
const NEXT_FORMS_PRELOAD_MAX = 24

// The child view shows no other toasts: only this one, so a tap that made no sound isn't silent.
// The id keeps repeated taps from stacking toasts.
function notifySpeechFailed() {
  toast.error('Heli ei õnnestunud. Puuduta uuesti.', { id: 'tts' })
}

export default function Runner({
  board,
  isParentMode,
  canEdit,
  hasPin,
  linkedBoards = {},
  backTo = null,
  speech = null,
  letterCase = 'upper',
}: RunnerProps) {
  const router = useRouter()
  // UUS: hoiame cellId + teksti
  const [sequence, setSequence] = useState<SequenceItem[]>([])
  const [activeCellId, setActiveCellId] = useState<string | null>(null)
  const [phrasePlaying, setPhrasePlaying] = useState(false)
  const [tempLabel, setTempLabel] = useState<{ id: string; text: string } | null>(null)
  const tapKeyRef = useRef(0)

  // The sentence handed over by the board a card opened this one from (or the one the child went
  // back from). Read after mounting: the server renders an empty phrase.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const handoff = JSON.parse(sessionStorage.getItem(PHRASE_HANDOFF_KEY) ?? 'null')
        sessionStorage.removeItem(PHRASE_HANDOFF_KEY)
        if (handoff?.to !== board.id || Date.now() - handoff.at > PHRASE_HANDOFF_MAX_AGE_MS) return
        const items = (Array.isArray(handoff.items) ? handoff.items : []).filter(
          (item: SequenceItem) => typeof item?.key === 'number' && typeof item.text === 'string',
        ) as SequenceItem[]
        if (items.length === 0) return
        tapKeyRef.current = Math.max(...items.map((item) => item.key))
        setSequence(items)
      } catch {
        // A broken handoff starts the sentence empty.
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [board.id])
  // AI forms on their way (AI setting): the sentence is fetched for "play all" once they are in.
  const [pendingAIForms, setPendingAIForms] = useState(0)

  // The board's own setting (saved in the editor); the runner plays the board the way the child gets it.
  const aiEnabled = board.extra?.ai ?? false
  const actionBarEnabled = board.actionBar?.enabled ?? false
  const wordClassColors = board.extra?.wordClassColors !== false
  // Word forms (src/utilities/grammar): "mina" + "jooksma" says "mina jooksen".
  const grammarEnabled = board.extra?.grammar !== false
  // Loaded after the board shows (a chunk of its own); until then words are said as written.
  const grammar = useGrammar(grammarEnabled)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUnlockedRef = useRef(false)
  const playbackTokenRef = useRef(0)
  const preloadedAudioUrlBySourceRef = useRef<Map<string, string>>(new Map())
  const preloadPromisesRef = useRef<Map<string, Promise<void>>>(new Map())
  // Unsaved speech by its prepared text (see SPOKEN_AUDIO_KEEP).
  const spokenAudioRef = useRef<Map<string, Promise<string | null>>>(new Map())
  // Preloads one saved speech file; the preload effect sets it, so its clean-up frees the file.
  const preloadAudioRef = useRef<(url: string) => void>(() => undefined)

  const cols = Math.max(1, board.grid?.cols ?? 6)
  const cells = useMemo(() => (board.grid?.cells ?? []).filter((c) => !c.locked), [board.grid?.cells])
  const cellById = useMemo(() => new Map(cells.map((c) => [String(c.id), c] as const)), [cells])
  // Cards a sentence can change ("jooksen", "õuna"), for loading their forms ahead.
  const formCells = useMemo(
    () => (grammar ? cells.filter((c) => c.title?.trim() && grammar.canChangeForm(c.title, c.wordClass)) : []),
    [cells, grammar],
  )
  const ttsCacheManifest = useMemo(() => getBoardTTSCacheManifest(board), [board])
  // The saved speech is in the site's voice; another voice or rate asks for the same word in it, which
  // the route makes on the first request and keeps.
  const speechQuery = speech ? `?voice=${encodeURIComponent(speech.voice)}&rate=${speech.rate}` : ''
  const cachedAudioUrlByText = useMemo(
    () => new Map(ttsCacheManifest.entries.map((entry) => [entry.text, entry.url + speechQuery] as const)),
    [ttsCacheManifest.entries, speechQuery],
  )

  const baseLayout: Layout[] = useMemo(
    () =>
      cells.map((c) => ({
        i: String(c.id),
        x: Number(c.x ?? 0),
        y: Number(c.y ?? 0),
        w: Number(c.w ?? 1),
        h: Number(c.h ?? 1),
        static: true,
      })),
    [cells],
  )

  // Fewer columns than the board has: the tiles in reading order (row by row), each into the
  // shortest column, so the child still finds the words in the board's order.
  const buildColumnLayout = (items: Layout[], colCount: number): Layout[] => {
    const safeColCount = Math.max(1, colCount)
    const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
    const colHeights = Array.from({ length: safeColCount }, () => 0)

    return sorted.map((item) => {
      const h = Math.max(1, item.h)

      const colIndex = colHeights.reduce(
        (shortestIndex, height, index) =>
          height < colHeights[shortestIndex] ? index : shortestIndex,
        0,
      )
      const y = colHeights[colIndex]
      colHeights[colIndex] += h

      return { ...item, x: colIndex, y, w: 1, h }
    })
  }

  const mdCols = Math.max(1, Math.min(cols, 4))
  const mobileCols = Math.max(1, Math.min(cols, 3))
  const [gridWidth, setGridWidth] = useState(0)

  useEffect(() => {
    const element = gridContainerRef.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      setGridWidth(entry.contentRect.width)
    })
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const activeGridCols = useMemo(() => {
    if (!gridWidth || gridWidth >= 1024) return cols
    const fullTileWidth = (gridWidth - GRID_MARGIN[0] * Math.max(0, cols - 1)) / cols
    if (fullTileWidth >= MIN_TILE_WIDTH) return cols
    if (gridWidth >= 768) return mdCols
    return mobileCols
  }, [cols, gridWidth, mdCols, mobileCols])
  const activeLayout = useMemo(
    () => (activeGridCols === cols ? baseLayout : buildColumnLayout(baseLayout, activeGridCols)),
    [activeGridCols, baseLayout, cols],
  )

  // The action bar is fixed to the bottom edge and taller on phones (the phrase above the buttons)
  // and above an iPhone's home indicator, so the page leaves room for its measured height: the last
  // row can always be scrolled clear of it.
  const actionBarRef = useRef<HTMLDivElement | null>(null)
  const [actionBarHeight, setActionBarHeight] = useState(0)
  useEffect(() => {
    const element = actionBarRef.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => setActionBarHeight(element.offsetHeight))
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const squareRowHeight = useMemo(() => {
    if (!gridWidth) return 140

    const horizontalGaps = GRID_MARGIN[0] * Math.max(0, activeGridCols - 1)
    return Math.max(96, Math.floor((gridWidth - horizontalGaps) / activeGridCols))
  }, [activeGridCols, gridWidth])

  const grammarInput = useCallback(
    (items: SequenceItem[]): GrammarToken[] =>
      items.map((item) => ({ text: item.text, wordClass: cellById.get(item.cellId)?.wordClass ?? item.wordClass ?? null })),
    [cellById],
  )

  // The words as the sentence says them: in the board's word forms, which compounds then override.
  const sentenceTokens = useCallback(
    (items: SequenceItem[], forms: Grammar | null = grammar): SelectedToken[] => {
      const said = forms ? forms.applyGrammar(grammarInput(items)) : null
      return items.map((item, index) => ({ id: item.cellId, text: said?.[index] ?? item.text }))
    },
    [grammar, grammarInput],
  )

  const tokens: SelectedToken[] = useMemo(() => sentenceTokens(sequence), [sequence, sentenceTokens])

  // AI sees: sõnaühendeid ei kasutata, jada jääb nagu on. AI väljas: rakenda sõnaühendid.
  const compoundsResult = useMemo(
    () => applyCompounds(tokens, aiEnabled ? null : board.compounds),
    [tokens, board.compounds, aiEnabled],
  )

  const phrase = compoundsResult.display
  const ttsAll = compoundsResult.tts

  const ensureAudioUnlocked = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'auto'
    }

    if (audioUnlockedRef.current || !audioRef.current) return

    const el = audioRef.current
    try {
      // tiny silent wav to satisfy Safari/iOS user-gesture requirement
      el.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA='
      el.muted = true
      const attempt = el.play()

      if (attempt && typeof attempt.then === 'function') {
        attempt
          .then(() => {
            audioUnlockedRef.current = true
            el.pause()
            el.currentTime = 0
          })
          .catch(() => {
            audioUnlockedRef.current = false
          })
      } else {
        audioUnlockedRef.current = true
      }
    } catch {
      audioUnlockedRef.current = false
    } finally {
      el.muted = false
    }
  }

  const playAudioURL = async (url: string): Promise<boolean> => {
    ensureAudioUnlocked()

    const audioEl = audioRef.current ?? new Audio()
    audioRef.current = audioEl
    const playbackToken = ++playbackTokenRef.current
    audioEl.pause()
    audioEl.onended = null
    audioEl.onerror = null

    return new Promise<boolean>((resolve) => {
      let done = false
      const cleanup = (played = true) => {
        if (done) return
        done = true
        audioEl.onended = null
        audioEl.onerror = null
        resolve(played)
      }

      audioEl.onended = () => cleanup()
      audioEl.onerror = () => cleanup(false)
      audioEl.src = url
      audioEl.currentTime = 0

      const started = audioEl.play()
      if (started && typeof started.catch === 'function') {
        started.catch((error: unknown) => cleanup(isInterruptedPlayback(error)))
      }

      if (playbackToken !== playbackTokenRef.current) {
        cleanup()
      }
    })
  }

  // An object URL of unsaved speech, or null when it couldn't be synthesized.
  const loadSpokenAudio = useCallback((preparedText: string): Promise<string | null> => {
    const store = spokenAudioRef.current
    const known = store.get(preparedText)
    if (known) {
      // The most recently used is kept longest.
      store.delete(preparedText)
      store.set(preparedText, known)
      return known
    }

    const loading: Promise<string | null> = fetch('/next/tts-ms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: preparedText, ...(speech ? { speaker: speech.voice, rate: speech.rate } : {}) }),
    })
      .then(async (res) => (res.ok ? URL.createObjectURL(await res.blob()) : null))
      .catch(() => null)
      .then((url) => {
        // A failure isn't kept, so the next try fetches again.
        if (!url && store.get(preparedText) === loading) store.delete(preparedText)
        return url
      })
    store.set(preparedText, loading)

    while (store.size > SPOKEN_AUDIO_KEEP) {
      const [oldestText, oldest] = store.entries().next().value!
      store.delete(oldestText)
      void oldest.then((url) => url && URL.revokeObjectURL(url))
    }

    return loading
  }, [speech])

  useEffect(() => {
    const store = spokenAudioRef.current
    return () => {
      for (const loading of store.values()) void loading.then((url) => url && URL.revokeObjectURL(url))
      store.clear()
    }
  }, [])

  // Fetch the sentence while the child builds it, so "play all" starts at once. With the AI setting,
  // once the AI's forms are in: the sentence before them would be fetched for nothing.
  useEffect(() => {
    const preparedText = prepareTextForTTS(ttsAll)
    if (!preparedText || cachedAudioUrlByText.has(preparedText)) return
    if (sequence.length > SENTENCE_PREFETCH_MAX_WORDS || pendingAIForms > 0) return

    const timer = window.setTimeout(() => void loadSpokenAudio(preparedText), SENTENCE_PREFETCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [ttsAll, sequence.length, pendingAIForms, cachedAudioUrlByText, loadSpokenAudio])

  // Resolves to false when no sound came out (speech failed to load or play).
  const playSpeech = async (text: string): Promise<boolean> => {
    const preparedText = prepareTextForTTS(text)
    const cachedURL = cachedAudioUrlByText.get(preparedText)
    // A tap while the speech loads plays its own word; this one then stays silent.
    let requestedAt = playbackTokenRef.current
    const superseded = () => playbackTokenRef.current !== requestedAt

    if (cachedURL) {
      const preloadPromise = preloadPromisesRef.current.get(cachedURL)
      if (preloadPromise) {
        await preloadPromise.catch(() => undefined)
      }
      if (superseded()) return true

      const preloadedURL = preloadedAudioUrlBySourceRef.current.get(cachedURL)
      if (preloadedURL) return playAudioURL(preloadedURL)

      // The saved speech didn't preload. The route makes missing audio on request, so one more
      // try usually plays; if it doesn't, the word is synthesized like unsaved speech.
      const retry = playAudioURL(cachedURL)
      // playAudioURL takes a new playback token as it starts; a later tap takes another.
      requestedAt = playbackTokenRef.current
      if (await retry) return true
      if (superseded()) return true
    }

    const url = await loadSpokenAudio(preparedText)
    if (superseded()) return true
    return url ? playAudioURL(url) : false
  }

  const stopCurrentAudio = () => {
    playbackTokenRef.current += 1
    const audioEl = audioRef.current
    if (!audioEl) return
    audioEl.pause()
    audioEl.currentTime = 0
    audioEl.onended = null
    audioEl.onerror = null
  }

  // Hands the sentence over to the board the child goes to (see PHRASE_HANDOFF_KEY).
  const handPhraseTo = (boardId: number) => handPhraseOver(boardId, sequence)

  const handleCellClick = async (cell: any) => {
    // A card that opens another board: the child goes there with the sentence, the word isn't said.
    if (typeof cell?.linkBoard === 'number' && linkedBoards[cell.linkBoard]) {
      stopCurrentAudio()
      handPhraseTo(cell.linkBoard)
      router.push(`/boards/${cell.linkBoard}?from=${board.id}`)
      return
    }

    const raw = cell?.title?.toString().trim()
    if (!raw) return

    ensureAudioUnlocked()
    stopCurrentAudio()
    setPhrasePlaying(false)
    const cellId = String(cell.id)
    const key = ++tapKeyRef.current
    try {
      const nextSequence: SequenceItem[] = [
        ...sequence,
        { key, cellId, text: raw, wordClass: cell.wordClass ?? null, image: cellImageSrc(cell) || undefined },
      ]
      // The word joins the phrase at once, so the next tap builds on it even while this one waits
      // for the word forms below.
      setSequence(nextSequence)
      setActiveCellId(cellId)

      // The words as the sentence says them (word forms), then compounds, which are off with AI on.
      // A tap before the word forms have loaded waits for them; if the child tapped on meanwhile,
      // the later tap speaks and this one stays silent.
      const forms = grammarEnabled ? (grammar ?? (await loadGrammar())) : null
      if (key !== tapKeyRef.current) return
      const nextTokens = sentenceTokens(nextSequence, forms)
      const form = nextTokens.at(-1)!.text
      const compoundForm = !aiEnabled
        ? getCompoundFormForLastToken(nextTokens, board.compounds)
        : null

      const spoken = compoundForm ? compoundForm.tts : form
      // The tile shows the written form; the speech form may be spelled for the voice.
      const shown = compoundForm ? compoundForm.surface : form

      setTempLabel({ id: cellId, text: shown })

      // With AI on, the word is said at once and the AI's form follows into the phrase and "play
      // all". A word the board's word forms change ("jooksen") is right already and isn't sent.
      if (aiEnabled && sequence.length > 0 && form === raw) {
        void fetchAIForm({ key, cellId, raw, contextTail: tokens.slice(-2).map((t) => t.text) })
      }

      if (!(await playSpeech(spoken))) notifySpeechFailed()
    } finally {
      // A later tap keeps its tile lit.
      if (key === tapKeyRef.current) setActiveCellId(null)
    }
  }

  // The AI's form of a tapped word (/next/groq), from the two words before it as the sentence says
  // them. It replaces the word in the phrase, and on its tile while that still shows the word; an
  // undone or cleared word is left alone.
  const fetchAIForm = async ({
    key,
    cellId,
    raw,
    contextTail,
  }: {
    key: number
    cellId: string
    raw: string
    contextTail: string[]
  }) => {
    setPendingAIForms((count) => count + 1)
    try {
      const response = await fetch('/next/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextTail, token: raw }),
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) return
      const json = (await response.json().catch(() => null)) as MorphResponse | null
      const surface = typeof json?.surface === 'string' ? json.surface.trim() : ''
      if (!surface || surface === raw) return

      setSequence((prev) => prev.map((item) => (item.key === key ? { ...item, text: surface } : item)))
      setTempLabel((current) =>
        current && current.id === cellId && current.text === raw ? { id: cellId, text: surface } : current,
      )
    } catch {
      // The word stays as tapped.
    } finally {
      setPendingAIForms((count) => count - 1)
    }
  }

  const handlePlayAll = async () => {
    if (!sequence.length) return
    ensureAudioUnlocked()
    stopCurrentAudio()
    setActiveCellId(null)
    setPhrasePlaying(true)
    try {
      // Sõnaühendite järgi kombineeritud fraas
      if (!(await playSpeech(ttsAll))) notifySpeechFailed()
    } finally {
      setPhrasePlaying(false)
    }
  }

  const handleClear = () => {
    setSequence([])
    setTempLabel(null)
  }

  const handleUndoLast = () => {
    if (!sequence.length || phrasePlaying) return

    setSequence((prev) => {
      const next = prev.slice(0, -1)
      const removed = prev[prev.length - 1]

      // kui viimane tempLabel oli selle celli küljes, nulli see
      if (removed) {
        setTempLabel((current) => (current && current.id === removed.cellId ? null : current))
      }

      return next
    })
  }

  const renderCellImage = (cell: any) => {
    const src = cellImageSrc(cell)
    if (!src) return null

    return (
      <div className="relative min-h-0 w-full flex-1 p-2 pb-1">
        <Image
          src={src}
          alt={cell.title ?? ''}
          fill
          sizes="(max-width: 768px) 100vw, 1200px"
          className="rounded object-contain p-2"
          priority={false}
          unoptimized={isSvgImageURL(src)}
        />
      </div>
    )
  }


  // The phrase shows each word in the form "play all" says it (a compound's form, e.g. "kassi").
  const sequenceCells = useMemo(
    () =>
      sequence.map((item, index) => ({
        ...item,
        text: compoundsResult.tokens[index]?.surface ?? item.text,
        cell: cells.find((c) => String(c.id) === item.cellId) ?? null,
      })),
    [sequence, cells, compoundsResult.tokens],
  )

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    el.scrollTo({
      left: el.scrollWidth,
      behavior: 'smooth',
    })
  }, [sequenceCells.length])

  useEffect(() => {
    let cancelled = false
    const objectURLs: string[] = []
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleCallbackId: number | null = null

    preloadedAudioUrlBySourceRef.current.clear()
    preloadPromisesRef.current.clear()

    const preload = (url: string) => {
      if (cancelled || preloadPromisesRef.current.has(url)) return
      const preloadPromise = (async () => {
        try {
          const response = await fetch(url, { credentials: 'include' })
          if (!response.ok) return

          const blob = await response.blob()
          const objectURL = URL.createObjectURL(blob)

          if (cancelled) {
            URL.revokeObjectURL(objectURL)
            return
          }

          objectURLs.push(objectURL)
          preloadedAudioUrlBySourceRef.current.set(url, objectURL)
        } catch {
          // Ignore preload failures; playback falls back to the original cache URL.
        }
      })()

      preloadPromisesRef.current.set(url, preloadPromise)
    }
    preloadAudioRef.current = preload

    // The cards and compounds load at once. A board has many more word forms than cards, so a
    // form loads when the sentence makes it the next one (below).
    const startPreload = () => {
      for (const entry of ttsCacheManifest.entries) {
        if (entry.source !== 'grammar') preload(entry.url + speechQuery)
      }
    }

    const schedulePreload = () => {
      if (cancelled) return

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleCallbackId = window.requestIdleCallback(() => startPreload(), { timeout: 1500 })
        return
      }

      timeoutId = setTimeout(() => startPreload(), 300)
    }

    if (typeof document !== 'undefined' && document.readyState === 'complete') {
      schedulePreload()
    } else if (typeof window !== 'undefined') {
      const handleLoad = () => {
        window.removeEventListener('load', handleLoad)
        schedulePreload()
      }

      window.addEventListener('load', handleLoad)

      return () => {
        cancelled = true
        window.removeEventListener('load', handleLoad)
        if (timeoutId) clearTimeout(timeoutId)
        if (idleCallbackId !== null && 'cancelIdleCallback' in window) {
          window.cancelIdleCallback(idleCallbackId)
        }
        preloadedAudioUrlBySourceRef.current.clear()
        preloadPromisesRef.current.clear()
        objectURLs.forEach((objectURL) => URL.revokeObjectURL(objectURL))
      }
    }

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (
        idleCallbackId !== null &&
        typeof window !== 'undefined' &&
        'cancelIdleCallback' in window
      ) {
        window.cancelIdleCallback(idleCallbackId)
      }
      preloadedAudioUrlBySourceRef.current.clear()
      preloadPromisesRef.current.clear()
      objectURLs.forEach((objectURL) => URL.revokeObjectURL(objectURL))
    }
  }, [ttsCacheManifest.entries, speechQuery])

  // The forms the cards take on the next tap ("jooksen" after "mina", "õuna" after "tahan") load
  // while the child looks for the card, a few at a time.
  useEffect(() => {
    if (!grammar || sequence.length === 0) return
    const said = grammarInput(sequence)
    let loading = 0
    for (const cell of formCells) {
      const title = cell.title!.trim()
      const form = grammar.applyGrammar([...said, { text: title, wordClass: cell.wordClass }]).at(-1)!
      if (form === title) continue
      const url = cachedAudioUrlByText.get(prepareTextForTTS(form))
      if (!url) continue
      preloadAudioRef.current(url)
      if (++loading >= NEXT_FORMS_PRELOAD_MAX) break
    }
  }, [grammar, sequence, grammarInput, formCells, cachedAudioUrlByText])

  return (
    <div
      className="pb-28 md:pb-24"
      style={actionBarHeight ? { paddingBottom: actionBarHeight + 16 } : undefined}
    >
      {!isParentMode && (
        <ChildModeBar
          hasPin={hasPin}
          title={board.name}
          back={backTo ? { href: `/boards/${backTo.id}`, name: backTo.name, onClick: () => handPhraseTo(backTo.id) } : null}
        />
      )}

      {/* The parent view shows the board as the child gets it; changing it happens in the editor. */}
      {isParentMode && (
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {backTo ? (
              <Button asChild variant="outline" size="icon" className="h-11 w-11 shrink-0">
                <Link
                  href={`/boards/${backTo.id}`}
                  aria-label={`Tagasi: ${backTo.name}`}
                  onClick={() => handPhraseTo(backTo.id)}
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
            <h1 className="text-3xl font-semibold">{board.name || 'Nimetu tahvel'}</h1>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/boards/${board.id}/print`}>
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Prindi
                </Link>
              </Button>
              <Button asChild className="gap-2">
                <Link href={`/boards/${board.id}/edit`}>
                  <Edit3 className="h-4 w-4" aria-hidden="true" />
                  Muuda tahvlit
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-500">
                Jagatud tahvel · muuta saab ainult tahvli looja
              </p>
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/boards/${board.id}/print`}>
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Prindi
                </Link>
              </Button>
              <CopyBoardButton boardId={board.id} returnTo={`/boards/${board.id}`} variant="button" />
            </div>
          )}
        </header>
      )}

      <div
        ref={actionBarRef}
        className="actionbar-container fixed inset-x-0 bottom-0 z-40 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-4"
      >
        <TooltipProvider>
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)] ring-1 ring-white/70 backdrop-blur md:flex-row md:items-stretch md:justify-between">
            {!isParentMode && <h1 className="sr-only">{board.name}</h1>}

            {actionBarEnabled && (
              <div className="flex min-h-16 min-w-0 max-w-full flex-1 items-center gap-2 overflow-hidden rounded-xl bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200/70">
                <div
                  ref={scrollContainerRef}
                  className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5"
                >
                  {sequenceCells.length === 0 ? (
                    <span className="text-sm text-slate-400">Vali pilte, et fraasi koostada</span>
                  ) : (
                    sequenceCells.map(({ cellId, cell, text, image, wordClass }, index) => {
                      // A word tapped on another board keeps its own picture and class.
                      const src = (cell ? cellImageSrc(cell) : '') || image || ''

                      const phraseColor = wordClassColors ? wordClassColor(cell?.wordClass ?? wordClass) : null

                      return (
                        <div
                          key={`${cellId}-${index}`}
                          // The box centres a word without a picture: the word is a block, so its
                          // first letter can be a capital (Suur algustäht).
                          className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ${
                            phraseColor ? 'border-[3px]' : 'ring-1 ring-slate-200'
                          }`}
                          style={phraseColor ? { borderColor: phraseColor } : undefined}
                        >
                          {src ? (
                            <>
                              <Image
                                src={src}
                                alt={cell?.title ?? text}
                                fill
                                sizes="56px"
                                className="object-contain"
                                priority={false}
                                unoptimized={isSvgImageURL(src)}
                              />
                              {/* a11y: tekst ekraanilugejale */}
                              <span className="sr-only">{text}</span>
                            </>
                          ) : (
                            <div
                              className={cn(
                                'w-full px-1 text-center text-[10px] font-semibold leading-tight',
                                LABEL_CASE_CLASS[letterCase],
                              )}
                            >
                              {text}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            <div className="flex shrink-0 items-center justify-between gap-2 md:justify-end">
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handlePlayAll}
                      aria-label="Esita kogu fraas"
                      roundness="full"
                      size="icon"
                      disabled={!sequence.length || phrasePlaying}
                      className="h-14 w-14 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 md:h-12 md:w-12"
                    >
                      {phrasePlaying ? (
                        <span className="inline-flex items-center gap-2">
                          <AnimatedVolumeIcon busy className="h-7 w-7 md:h-6 md:w-6" />
                        </span>
                      ) : (
                        <Volume2Icon className="h-7 w-7 md:h-6 md:w-6" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {!sequence.length
                        ? 'Lisa enne sõnu'
                        : phrasePlaying
                          ? 'Esitan praegu'
                          : 'Esita kogu fraas'}
                    </p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={sequence.length && !phrasePlaying ? 'secondary' : 'muted'}
                      size="icon"
                      disabled={!sequence.length || phrasePlaying}
                      onClick={handleUndoLast}
                      aria-label="Võta viimane tagasi"
                      roundness="full"
                      className="h-11 w-11 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <Undo2 className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {!sequence.length
                        ? 'Pole midagi tagasi võtta'
                        : phrasePlaying
                          ? 'Oota, heli mängib'
                          : 'Võta viimane tagasi'}
                    </p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={sequence.length && !phrasePlaying ? 'destructive' : 'muted'}
                      size="icon"
                      disabled={!sequence.length || phrasePlaying}
                      onClick={handleClear}
                      aria-label="Tühjenda fraas"
                      roundness="full"
                      className="h-11 w-11 bg-rose-600 text-white shadow-sm hover:bg-rose-700 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <Trash className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {!sequence.length
                        ? 'Pole midagi tühjendada'
                        : phrasePlaying
                          ? 'Oota, heli mängib'
                          : 'Tühjenda fraas'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </div>

      {/* The grid gets the width measured here, so the columns, the tile width and the square row
          height all come from the same number, also when the device turns. It renders once that
          width is known, so tiles don't first appear at a fallback size. */}
      <div ref={gridContainerRef}>
        {gridWidth > 0 ? (
          <ReactGridLayout
            className="layout"
            width={gridWidth}
            cols={activeGridCols}
            rowHeight={squareRowHeight}
            isResizable={false}
            isDraggable={false}
            margin={GRID_MARGIN}
            containerPadding={[0, 0]}
            compactType={null}
            preventCollision
            layout={activeLayout}
          >
            {cells.map((cell) => {
              const cellIdString = String(cell.id)

              // UUS: Kontrollime, kas sellele kaardile on määratud ajutine tekst
              const isOverridden = tempLabel?.id === cellIdString
              const isActiveCell = activeCellId === cellIdString
              const titleToShow = isOverridden && tempLabel ? tempLabel.text : cell.title
              const classColor = wordClassColors ? wordClassColor(cell.wordClass) : null
              // A card that opens another board the user can read.
              const opens = typeof cell.linkBoard === 'number' ? linkedBoards[cell.linkBoard] : undefined

              return (
                <div
                  key={cellIdString}
                  // Hover styles only where a pointer hovers: a touch screen keeps :hover on the
                  // last tapped tile, which then stayed orange as if it were still speaking.
                  className={`relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-white p-2 shadow-lg transition-all duration-150 active:translate-y-0 active:scale-[0.96] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:scale-[1.025] ${
                    classColor
                      ? `cursor-pointer border-4 ring-4 ${
                          isActiveCell
                            ? 'ring-[color:var(--tile-ring)]'
                            : 'ring-transparent [@media(hover:hover)]:hover:ring-[color:var(--tile-ring-hover)]'
                        }`
                      : `border-2 ring-2 ${
                          isActiveCell
                            ? 'cursor-pointer border-[#ff980d] ring-[#ff980d]/45 [@media(hover:hover)]:hover:ring-[#ff980d]/70'
                            : 'cursor-pointer border-slate-200 ring-transparent [@media(hover:hover)]:hover:border-[#ff980d] [@media(hover:hover)]:hover:ring-[#ff980d]/35'
                        }`
                  }`}
                  style={classColor ? wordClassTileStyle(classColor) : undefined}
                  data-word-class={classColor ? cell.wordClass : undefined}
                >
                  {renderCellImage(cell)}

                  {titleToShow && (
                    <CellLabel
                      title={titleToShow}
                      className="pointer-events-none transition-colors duration-200"
                      letterCase={letterCase}
                    />
                  )}

                  {opens ? (
                    <FolderOpen
                      className="pointer-events-none absolute right-1.5 top-1.5 h-6 w-6 rounded-md bg-white/90 p-0.5 text-slate-600"
                      aria-hidden="true"
                    />
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleCellClick(cell)}
                    className="absolute inset-0 cursor-pointer"
                    aria-label={opens ? `${titleToShow ?? 'valik'}, avab tahvli ${opens}` : (titleToShow ?? 'valik')}
                  />
                </div>
              )
            })}
          </ReactGridLayout>
        ) : null}
      </div>
    </div>
  )
}
