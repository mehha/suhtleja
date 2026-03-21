// src/app/(frontend)/boards/[id]/Runner.tsx
'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { Board, Media } from '@/payload-types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sparkles, Slash, WholeWord, Trash, Undo2, Volume2Icon, Edit3 } from 'lucide-react'
import { WidthProvider, Responsive as ResponsiveGrid, type Layout, type Layouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

// UUS: sõnaühendite util
import { applyCompounds, Compound, type SelectedToken } from './compounds/applyCompounds'
import { getCompoundFormForLastToken } from './compounds/getCompoundFormForLastToken'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { AnimatedVolumeIcon } from '@/components/Animations/AnimatedVolumeIcon'
import { getBoardTTSCacheManifest } from '@/utilities/boardTTSCacheManifest'
import { prepareTextForTTS } from '@/utilities/azureTTS'

const ResponsiveGridLayout = WidthProvider(ResponsiveGrid)

type RunnerProps = { board: Board; isParentMode: boolean }

type SequenceItem = {
  cellId: string
  text: string
}

type MorphResponse = {
  surface?: string
}

export default function Runner({ board, isParentMode }: RunnerProps) {
  // UUS: hoiame cellId + teksti
  const [sequence, setSequence] = useState<SequenceItem[]>([])
  const [busy, setBusy] = useState(false)
  const [tempLabel, setTempLabel] = useState<{ id: string; text: string } | null>(null)

  const aiAllowed = board.extra?.ai ?? false
  const actionBarEnabled = board.actionBar?.enabled ?? false
  const [aiEnabled, setAiEnabled] = useState<boolean>(aiAllowed)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUnlockedRef = useRef(false)

  const cols = Math.max(1, board.grid?.cols ?? 6)
  const cells = (board.grid?.cells ?? []).filter((c) => !c.locked)
  const ttsCacheManifest = useMemo(() => getBoardTTSCacheManifest(board), [board])
  const cachedAudioUrlByText = useMemo(
    () =>
      new Map(
        ttsCacheManifest.entries.map((entry) => [entry.text, entry.url] as const),
      ),
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

  const buildTwoColumnLayout = (items: Layout[]): Layout[] => {
    const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
    const colHeights = [0, 0]

    return sorted.map((item) => {
      const w = Math.max(1, Math.min(item.w, 2))
      const h = Math.max(1, item.h)

      if (w === 2) {
        const y = Math.max(colHeights[0], colHeights[1])
        colHeights[0] = y + h
        colHeights[1] = y + h
        return { ...item, x: 0, y, w: 2, h }
      }

      const colIndex = colHeights[0] <= colHeights[1] ? 0 : 1
      const y = colHeights[colIndex]
      colHeights[colIndex] += h

      return { ...item, x: colIndex, y, w: 1, h }
    })
  }

  const mdCols = Math.max(1, Math.min(cols, 4))
  const responsiveLayouts: Layouts = useMemo(
    () => ({
      lg: baseLayout,
      md: clampLayoutToCols(baseLayout, mdCols),
      sm: buildTwoColumnLayout(baseLayout),
      xs: buildTwoColumnLayout(baseLayout),
    }),
    [baseLayout, mdCols],
  )

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

  const playAudioURL = async (url: string) => {
    ensureAudioUnlocked()

    const audioEl = audioRef.current ?? new Audio()
    audioRef.current = audioEl

    await new Promise<void>((resolve) => {
      let done = false
      const cleanup = () => {
        if (done) return
        done = true
        audioEl.onended = null
        audioEl.onerror = null
        resolve()
      }

      audioEl.onended = cleanup
      audioEl.onerror = cleanup
      audioEl.src = url
      audioEl.currentTime = 0

      const started = audioEl.play()
      if (started && typeof started.catch === 'function') {
        started.catch(() => cleanup())
      }
    })
  }

  const playSpeech = async (text: string) => {
    const preparedText = prepareTextForTTS(text)
    const cachedURL = cachedAudioUrlByText.get(preparedText)

    if (cachedURL) {
      await playAudioURL(cachedURL)
      return
    }

    const res = await fetch('/next/tts-ms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: preparedText,
      }),
    })

    if (!res.ok) return

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audioEl = audioRef.current ?? new Audio()
    audioRef.current = audioEl

    await new Promise<void>((resolve) => {
      let done = false
      const cleanup = () => {
        if (done) return
        done = true
        audioEl.onended = null
        audioEl.onerror = null
        URL.revokeObjectURL(url)
        resolve()
      }

      audioEl.onended = cleanup
      audioEl.onerror = cleanup
      audioEl.src = url
      audioEl.currentTime = 0

      const started = audioEl.play()
      if (started && typeof started.catch === 'function') {
        started.catch(() => cleanup())
      }
    })
  }

  const handleCellClick = async (cell: any) => {
    if (busy) return

    const raw = cell?.title?.toString().trim()
    if (!raw) return

    ensureAudioUnlocked()
    setBusy(true)
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

      setTempLabel({ id: String(cell.id), text: spoken })

      // 5) Loeme ainult selle sõna vormi
      await playSpeech(spoken)
    } finally {
      setBusy(false)
    }
  }

  const handlePlayAll = async () => {
    if (!sequence.length) return
    ensureAudioUnlocked()
    setBusy(true)
    try {
      // Sõnaühendite järgi kombineeritud fraas
      await playSpeech(ttsAll)
    } finally {
      setBusy(false)
    }
  }

  const handleClear = () => {
    setSequence([])
    setTempLabel(null)
  }

  const handleUndoLast = () => {
    if (!sequence.length || busy) return

    setSequence((prev) => {
      const next = prev.slice(0, -1)
      const removed = prev[prev.length - 1]

      // kui viimane tempLabel oli selle celli küljes, nulli see
      if (removed) {
        setTempLabel((current) =>
          current && current.id === removed.cellId ? null : current,
        )
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
      <div className="relative w-full h-full min-h-[4rem]">
        <Image
          src={src}
          alt={cell.title ?? ''}
          fill
          sizes="(max-width: 768px) 100vw, 1200px"
          className="object-contain rounded"
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
    const preloadMap = new Map<string, HTMLAudioElement>()

    for (const url of cachedAudioUrlByText.values()) {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.src = url
      audio.load()
      preloadMap.set(url, audio)
    }

    return () => {
      preloadMap.forEach((audio) => {
        audio.pause()
        audio.src = ''
      })
    }
  }, [cachedAudioUrlByText])

  return (
    <div>
      <div className="container">
        <TooltipProvider>
          <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 lg:gap-10">
            <h1 className="text-center text-3xl font-semibold sr-only">{board.name}</h1>

            {actionBarEnabled && (
              <div className="flex flex-1 min-h-[122px] items-center gap-3 rounded-3xl border bg-white ps-6 pe-2 py-2 shadow-lg ring-1 ring-gray-900/5">
                <div ref={scrollContainerRef} className="flex-1 flex items-center gap-2 overflow-x-auto py-1">
                  {sequenceCells.length === 0 ? (
                    <span className="text-sm text-slate-400">
                      Vali pilte, et fraasi koostada
                    </span>
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
                          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-white"
                        >
                          {src ? (
                            <>
                              <Image
                                src={src}
                                alt={cell?.title ?? text}
                                fill
                                sizes="96px"
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
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handlePlayAll}
                        roundness="full"
                        size="icon"
                        disabled={!sequence.length || busy}
                      >
                        {busy ? (
                          <span className="inline-flex items-center gap-2">
                            <AnimatedVolumeIcon busy className="h-6 w-6" />
                          </span>
                        ) : (
                          <Volume2Icon className="h-6 w-6" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {!sequence.length
                          ? 'Lisa enne sõnu'
                          : busy
                            ? 'Esitan praegu'
                            : 'Esita kogu fraas'}
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={sequence.length && !busy ? 'secondary' : 'muted'}
                        size="icon"
                        disabled={!sequence.length || busy}
                        onClick={handleUndoLast}
                        roundness="full"
                      >
                        <Undo2 className="h-6 w-6" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {!sequence.length
                          ? 'Pole midagi tagasi võtta'
                          : busy
                            ? 'Oota, heli mängib'
                            : 'Võta viimane tagasi'}
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={sequence.length && !busy ? 'destructive' : 'muted'}
                        size="icon"
                        disabled={!sequence.length || busy}
                        onClick={handleClear}
                        roundness="full"
                      >
                        <Trash className="h-6 w-6" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {!sequence.length
                          ? 'Pole midagi tühjendada'
                          : busy
                            ? 'Oota, heli mängib'
                            : 'Tühjenda fraas'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}

            <div className="flex flex-wrap md:items-end md:flex-col gap-2">
              <Button
                type="button"
                size="sm"
                roundness="2xl"
                variant={aiEnabled ? 'positive' : 'muted'}
                onClick={() => setAiEnabled((v) => !v)}
                aria-pressed={aiEnabled}
                title={
                  aiEnabled ? 'AI on: parandab sõna kuju' : 'AI off: loeb täpselt valitud sõna'
                }
                className="inline-flex items-center gap-2"
              >
                {aiEnabled ? <Sparkles size={16} /> : <Slash size={16} />}
                {aiEnabled ? 'AI: sees' : 'AI: väljas'}
              </Button>

              {/* Halda sõnaühendeid + tooltip */}
              <Tooltip>
                <TooltipTrigger asChild>
                  {isParentMode ? (
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/boards/${board.id}/compounds`}>
                        <WholeWord className="mr-2 h-5 w-5 text-pink-600" />
                        Halda sõnaühendeid
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm">
                      <WholeWord className="h-5 w-5" />
                      <span className="sr-only">Sõnaühendite haldus</span>
                    </Button>
                  )}
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  {compounds.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sõnaühendeid pole veel lisatud.</p>
                  ) : (
                    <div className="max-h-[260px] space-y-2 overflow-y-auto text-xs">
                      {compounds.map((compound) => {
                        const surfaces = compound.parts?.map((p) => p.surface).join(' ') ?? ''

                        return (
                          <div key={compound.id} className="rounded border bg-muted/40 px-2 py-1">
                            <div className="font-medium">{surfaces || '—'}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>

              {isParentMode && (
                <Link href={`/boards/${board.id}/edit`}>
                  <Button variant="secondary" roundness="full" size="sm">
                    <Edit3 className="h-4 w-4 mr-2" />
                    <span>Muuda</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </TooltipProvider>
      </div>

      <ResponsiveGridLayout
        className="layout"
        breakpoints={{ lg: 1024, md: 768, sm: 640, xs: 0 }}
        cols={{ lg: cols, md: mdCols, sm: 2, xs: 2 }}
        rowHeight={200}
        isResizable={false}
        isDraggable={false}
        margin={[16, 16]}
        compactType={null}
        preventCollision
        layouts={responsiveLayouts}
      >
        {cells.map((cell) => {
          const cellIdString = String(cell.id)

          // UUS: Kontrollime, kas sellele kaardile on määratud ajutine tekst
          const isOverridden = tempLabel?.id === cellIdString
          const titleToShow = isOverridden && tempLabel ? tempLabel.text : cell.title

          return (
            <div
              key={cellIdString}
              className={`relative flex aspect-[4/3] flex-col gap-1 overflow-hidden rounded-xl border bg-white p-0 shadow-lg ring-1 ring-gray-900/5 ${
                busy ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {renderCellImage(cell)}

              {/* Muutsime tingimust, et kuvada titleToShow */}
              {titleToShow && (
                <div
                  className={`pointer-events-none absolute bottom-0 left-0 w-full p-2 text-center text-white transition-colors duration-200 ${
                    isOverridden ? 'bg-blue-600/90' : 'bg-slate-800/85'
                  }`}
                >
                  <div className="break-words text-2xl uppercase leading-4">{titleToShow}</div>
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleCellClick(cell)}
                disabled={busy}
                className={`absolute inset-0 ${busy ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                aria-label={titleToShow ?? 'valik'}
              />
            </div>
          )
        })}
      </ResponsiveGridLayout>
    </div>
  )
}
