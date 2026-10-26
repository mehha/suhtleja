// src/app/(frontend)/boards/[id]/Runner.tsx
'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { Board, Media } from '@/payload-types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Edit3,
  Sparkles,
  Slash,
  Trash,
  Undo2,
  Volume2Icon,
  WholeWord,
} from 'lucide-react'
import {
  WidthProvider,
  Responsive as ResponsiveGrid,
  type Layout,
  type Layouts,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

// UUS: sõnaühendite util
import { applyCompounds, Compound, type SelectedToken } from './compounds/applyCompounds'
import { getCompoundFormForLastToken } from './compounds/getCompoundFormForLastToken'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { AnimatedVolumeIcon } from '@/components/Animations/AnimatedVolumeIcon'
import { getBoardTTSCacheManifest } from '@/utilities/boardTTSCacheManifest'
import { prepareTextForTTS } from '@/utilities/azureTTS'
import { ChildModeBar } from '@/app/(frontend)/kodu/ChildModeBar'
import { toast } from 'sonner'

const ResponsiveGridLayout = WidthProvider(ResponsiveGrid)
const GRID_MARGIN: [number, number] = [16, 16]

type RunnerProps = { board: Board; isParentMode: boolean; canEdit: boolean; hasPin: boolean }

type SequenceItem = {
  cellId: string
  text: string
}

type MorphResponse = {
  surface?: string
}

// play() rejects with AbortError when a newer tap interrupts it; that isn't a failure.
function isInterruptedPlayback(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

// The child view shows no other toasts: only this one, so a tap that made no sound isn't silent.
// The id keeps repeated taps from stacking toasts.
function notifySpeechFailed() {
  toast.error('Heli ei õnnestunud. Puuduta uuesti.', { id: 'tts' })
}

export default function Runner({ board, isParentMode, canEdit, hasPin }: RunnerProps) {
  // UUS: hoiame cellId + teksti
  const [sequence, setSequence] = useState<SequenceItem[]>([])
  const [activeCellId, setActiveCellId] = useState<string | null>(null)
  const [phrasePlaying, setPhrasePlaying] = useState(false)
  const [tempLabel, setTempLabel] = useState<{ id: string; text: string } | null>(null)

  const aiAllowed = board.extra?.ai ?? false
  const actionBarEnabled = board.actionBar?.enabled ?? false
  const [aiEnabled, setAiEnabled] = useState<boolean>(aiAllowed)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUnlockedRef = useRef(false)
  const playbackTokenRef = useRef(0)
  const preloadedAudioUrlBySourceRef = useRef<Map<string, string>>(new Map())
  const preloadPromisesRef = useRef<Map<string, Promise<void>>>(new Map())

  const cols = Math.max(1, board.grid?.cols ?? 6)
  const cells = (board.grid?.cells ?? []).filter((c) => !c.locked)
  const ttsCacheManifest = useMemo(() => getBoardTTSCacheManifest(board), [board])
  const cachedAudioUrlByText = useMemo(
    () => new Map(ttsCacheManifest.entries.map((entry) => [entry.text, entry.url] as const)),
    [ttsCacheManifest.entries],
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

  const clampLayoutToCols = (items: Layout[], colCount: number): Layout[] =>
    items.map((item) => {
      const w = Math.max(1, Math.min(item.w, colCount))
      const maxX = Math.max(0, colCount - w)
      return {
        ...item,
        w,
        x: Math.min(item.x, maxX),
      }
    })

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
  const responsiveLayouts: Layouts = useMemo(
    () => ({
      lg: baseLayout,
      md: clampLayoutToCols(baseLayout, mdCols),
      sm: buildColumnLayout(baseLayout, mobileCols),
      xs: buildColumnLayout(baseLayout, mobileCols),
    }),
    [baseLayout, mdCols, mobileCols],
  )

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
    if (gridWidth >= 1024) return cols
    if (gridWidth >= 768) return mdCols
    return mobileCols
  }, [cols, gridWidth, mdCols, mobileCols])

  const squareRowHeight = useMemo(() => {
    if (!gridWidth) return 140

    const horizontalGaps = GRID_MARGIN[0] * Math.max(0, activeGridCols - 1)
    return Math.max(96, Math.floor((gridWidth - horizontalGaps) / activeGridCols))
  }, [activeGridCols, gridWidth])

  const tokens: SelectedToken[] = useMemo(
    () =>
      sequence.map((item) => ({
        id: item.cellId,
        text: item.text,
      })),
    [sequence],
  )

  const compoundsResult = useMemo(() => {
    // AI sees: compounds ei kasutata, lihtsalt toores jada
    if (aiEnabled) {
      const base = tokens.map((t) => t.text).join(' ')
      return { display: base, tts: base }
    }

    // AI väljas: rakenda compounds
    return applyCompounds(tokens, board.compounds)
  }, [tokens, board.compounds, aiEnabled])

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

  // Resolves to false when no sound came out (speech failed to load or play).
  const playSpeech = async (text: string): Promise<boolean> => {
    const preparedText = prepareTextForTTS(text)
    const cachedURL = cachedAudioUrlByText.get(preparedText)

    if (cachedURL) {
      const preloadPromise = preloadPromisesRef.current.get(cachedURL)
      if (preloadPromise) {
        await preloadPromise.catch(() => undefined)
      }

      const readyURL = preloadedAudioUrlBySourceRef.current.get(cachedURL) ?? cachedURL
      return playAudioURL(readyURL)
    }

    let blob: Blob
    try {
      const res = await fetch('/next/tts-ms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: preparedText,
        }),
      })

      if (!res.ok) return false
      blob = await res.blob()
    } catch {
      return false
    }

    const url = URL.createObjectURL(blob)
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
        URL.revokeObjectURL(url)
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

  const stopCurrentAudio = () => {
    playbackTokenRef.current += 1
    const audioEl = audioRef.current
    if (!audioEl) return
    audioEl.pause()
    audioEl.currentTime = 0
    audioEl.onended = null
    audioEl.onerror = null
  }

  const handleCellClick = async (cell: any) => {
    const raw = cell?.title?.toString().trim()
    if (!raw) return

    ensureAudioUnlocked()
    stopCurrentAudio()
    setPhrasePlaying(false)
    try {
      let surface = raw

      // AI korrigeerib ainult seda uut tokenit
      if (aiEnabled && sequence.length > 0) {
        try {
          const mr = await fetch('/next/groq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contextTail: sequence.slice(-2).map((s) => s.text),
              token: raw,
            }),
            signal: AbortSignal.timeout(5000),
          })
          if (mr.ok) {
            const j = (await mr.json().catch(() => null)) as MorphResponse | null
            if (j && typeof j.surface === 'string' && j.surface.trim()) {
              surface = j.surface.trim()
            }
          }
        } catch {
          surface = raw
        }
      }

      // 1) Ehita nextSequence
      const nextSequence: SequenceItem[] = [...sequence, { cellId: String(cell.id), text: surface }]

      // 2) Teisenda SelectedTokeniteks
      const nextTokens: SelectedToken[] = nextSequence.map((item) => ({
        id: item.cellId,
        text: item.text,
      }))

      // 3) Kui AI on väljas, proovi compounds; kui AI sees, ära kasuta compounds
      const compoundForm = !aiEnabled
        ? getCompoundFormForLastToken(nextTokens, board.compounds)
        : null

      const spoken = compoundForm ? compoundForm.tts : surface

      // 4) Uuenda jada state
      setSequence(nextSequence)

      const cellId = String(cell.id)
      setActiveCellId(cellId)
      setTempLabel({ id: cellId, text: spoken })

      // 5) Loeme ainult selle sõna vormi
      if (!(await playSpeech(spoken))) notifySpeechFailed()
    } finally {
      setActiveCellId(null)
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
    const src =
      cell?.externalImageURL ||
      (cell?.image && typeof cell.image === 'object' && (cell.image as Media).url) ||
      ''
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
        />
      </div>
    )
  }

  const compounds = (board.compounds ?? []) as Compound[]

  const sequenceCells = useMemo(
    () =>
      sequence.map((item) => ({
        ...item,
        cell: cells.find((c) => String(c.id) === item.cellId) ?? null,
      })),
    [sequence, cells],
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

    const startPreload = () => {
      for (const url of cachedAudioUrlByText.values()) {
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
  }, [cachedAudioUrlByText])

  return (
    <div className={`pb-28 md:pb-24 ${!isParentMode ? 'pt-14' : ''}`}>
      {!isParentMode && <ChildModeBar hasPin={hasPin} />}

      <div className="actionbar-container fixed inset-x-0 bottom-0 z-40 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-4">
        <TooltipProvider>
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)] ring-1 ring-white/70 backdrop-blur md:flex-row md:items-stretch md:justify-between">
            <h1 className="text-center text-3xl font-semibold sr-only">{board.name}</h1>

            {actionBarEnabled && (
              <div className="flex min-h-16 min-w-0 max-w-full flex-1 items-center gap-2 overflow-hidden rounded-xl bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200/70">
                <div
                  ref={scrollContainerRef}
                  className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5"
                >
                  {sequenceCells.length === 0 ? (
                    <span className="text-sm text-slate-400">Vali pilte, et fraasi koostada</span>
                  ) : (
                    sequenceCells.map(({ cellId, cell, text }, index) => {
                      const src =
                        cell?.externalImageURL ||
                        (cell?.image &&
                          typeof cell.image === 'object' &&
                          (cell.image as Media).url) ||
                        ''

                      return (
                        <div
                          key={`${cellId}-${index}`}
                          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200"
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
                              />
                              {/* a11y: tekst ekraanilugejale */}
                              <span className="sr-only">{text}</span>
                            </>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-semibold uppercase leading-tight">
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

              {isParentMode && (
                <>
                  <div className="h-9 w-px bg-slate-200" />

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      roundness="full"
                      variant={aiEnabled ? 'positive' : 'muted'}
                      onClick={() => setAiEnabled((v) => !v)}
                      aria-pressed={aiEnabled}
                      title={
                        aiEnabled
                          ? 'AI on: parandab sõna kuju'
                          : 'AI off: loeb täpselt valitud sõna'
                      }
                      className="h-10 gap-1.5 px-3 shadow-sm"
                    >
                      {aiEnabled ? <Sparkles size={16} /> : <Slash size={16} />}
                      <span className="hidden sm:inline">
                        {aiEnabled ? 'AI sees' : 'AI väljas'}
                      </span>
                    </Button>

                    {/* Halda sõnaühendeid + tooltip */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {canEdit ? (
                          <Button
                            variant="secondary"
                            size="icon"
                            asChild
                            className="h-10 w-10 border-slate-200 bg-white shadow-sm"
                          >
                            <Link href={`/boards/${board.id}/compounds`}>
                              <WholeWord className="h-5 w-5 text-pink-600" />
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-10 w-10 border-slate-200 bg-white shadow-sm"
                          >
                            <WholeWord className="h-5 w-5" />
                            <span className="sr-only">Sõnaühendite haldus</span>
                          </Button>
                        )}
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        {compounds.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Sõnaühendeid pole veel lisatud.
                          </p>
                        ) : (
                          <div className="max-h-[260px] space-y-2 overflow-y-auto text-xs">
                            {compounds.map((compound) => {
                              const surfaces = compound.parts?.map((p) => p.surface).join(' ') ?? ''

                              return (
                                <div
                                  key={compound.id}
                                  className="rounded border bg-muted/40 px-2 py-1"
                                >
                                  <div className="font-medium">{surfaces || '—'}</div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </TooltipContent>
                    </Tooltip>

                    {canEdit && (
                      <Link href={`/boards/${board.id}/edit`}>
                        <Button
                          variant="secondary"
                          roundness="full"
                          size="icon"
                          className="h-10 w-10 border-slate-200 bg-white shadow-sm"
                        >
                          <Edit3 className="h-4 w-4" />
                          <span className="sr-only">Muuda</span>
                        </Button>
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </TooltipProvider>
      </div>

      <div ref={gridContainerRef}>
        <ResponsiveGridLayout
          className="layout"
          breakpoints={{ lg: 1024, md: 768, sm: 640, xs: 0 }}
          cols={{ lg: cols, md: mdCols, sm: mobileCols, xs: mobileCols }}
          rowHeight={squareRowHeight}
          isResizable={false}
          isDraggable={false}
          margin={GRID_MARGIN}
          containerPadding={[0, 0]}
          compactType={null}
          preventCollision
          layouts={responsiveLayouts}
        >
          {cells.map((cell) => {
            const cellIdString = String(cell.id)

            // UUS: Kontrollime, kas sellele kaardile on määratud ajutine tekst
            const isOverridden = tempLabel?.id === cellIdString
            const isActiveCell = activeCellId === cellIdString
            const titleToShow = isOverridden && tempLabel ? tempLabel.text : cell.title

            return (
              <div
                key={cellIdString}
                className={`relative flex h-full w-full flex-col overflow-hidden rounded-xl border-2 bg-white p-2 shadow-lg ring-2 transition-all duration-150 hover:-translate-y-1 hover:scale-[1.025] active:translate-y-0 active:scale-[0.96] ${
                  isActiveCell
                    ? 'cursor-pointer border-[#ff980d] ring-[#ff980d]/45 hover:ring-[#ff980d]/70'
                    : 'cursor-pointer border-slate-200 ring-transparent hover:border-[#ff980d] hover:ring-[#ff980d]/35'
                }`}
              >
                {renderCellImage(cell)}

                {titleToShow && (
                  <div className="pointer-events-none shrink-0 px-1 pb-1 text-center uppercase text-slate-950 transition-colors duration-200">
                    <div className="break-words text-xl font-semibold leading-5">
                      {titleToShow}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void handleCellClick(cell)}
                  className="absolute inset-0 cursor-pointer"
                  aria-label={titleToShow ?? 'valik'}
                />
              </div>
            )
          })}
        </ResponsiveGridLayout>
      </div>
    </div>
  )
}
