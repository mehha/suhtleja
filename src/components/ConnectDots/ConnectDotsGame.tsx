'use client'
import {
  type PointerEvent as ReactPointerEvent,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  CheckCircle2,
  Eye,
  MousePointer2,
  PencilLine,
  RefreshCw,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/utilities/ui'
import {
  CONNECT_DOTS_COUNT_MODE_OPTIONS,
  CONNECT_DOTS_INTERACTION_MODE_OPTIONS,
  type ConnectDotsCountMode,
  type ConnectDotsInteractionMode,
  type ConnectDotsPuzzle,
  distanceBetweenPoints,
  getContainedImageRect,
  getConnectDotsLabel,
  getNormalizedPointFromContainedRect,
  getRevealOpacity,
} from '@/utilities/connectDots'

type ConnectDotsGameProps = {
  embedded?: boolean
  initialPuzzleId?: string
  puzzles: ConnectDotsPuzzle[]
  revealMode?: 'complete' | 'progressive'
  showPicker?: boolean
}

type PointerPosition = {
  x: number
  y: number
}

const TRACE_RADIUS = 0.05
const CONNECT_DOTS_MUSIC_MUTED_KEY = 'connect-dots-music-muted'
const CONNECT_DOTS_MUSIC_VOLUME = 0.2
const CONNECT_DOTS_SUCCESS_AUDIO_URL = '/great-success-borat.mp3'
const CONNECT_DOTS_SUCCESS_VOLUME = 0.9
const SILENT_AUDIO_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA='
const PENCIL_CURSOR =
  'url(\'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"%3E%3Cg transform="rotate(-18 36 36)"%3E%3Crect x="28" y="8" width="16" height="36" rx="4" fill="%23f59e0b"/%3E%3Crect x="28" y="40" width="16" height="10" fill="%23fbbf24"/%3E%3Cpolygon points="28,50 44,50 36,66" fill="%23334155"/%3E%3Cpolygon points="32,59 40,59 36,66" fill="%23ffffff"/%3E%3Crect x="28" y="4" width="16" height="8" rx="3" fill="%23ef4444"/%3E%3C/g%3E%3C/svg%3E\') 36 60, auto'

export function ConnectDotsGame({
  embedded = false,
  initialPuzzleId,
  puzzles,
  revealMode = 'progressive',
  showPicker = true,
}: ConnectDotsGameProps) {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const successAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioUnlockedRef = useRef(false)
  const activeMusicUrlRef = useRef<string | null>(null)
  const wrongClickTimeoutRef = useRef<number | null>(null)
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 })
  const [selectedPuzzleId, setSelectedPuzzleId] = useState(initialPuzzleId ?? puzzles[0]?.id ?? '')
  const [countMode, setCountMode] = useState<ConnectDotsCountMode>('count-1')
  const [interactionMode, setInteractionMode] = useState<ConnectDotsInteractionMode>('click')
  const [visitedIndexes, setVisitedIndexes] = useState<number[]>([0])
  const [traceActive, setTraceActive] = useState(false)
  const [pointerPosition, setPointerPosition] = useState<PointerPosition | null>(null)
  const [musicMuted, setMusicMuted] = useState(false)
  const [successBurstVisible, setSuccessBurstVisible] = useState(false)
  const [wrongClickFlashVisible, setWrongClickFlashVisible] = useState(false)

  const puzzle = useMemo(() => {
    return puzzles.find((entry) => entry.id === selectedPuzzleId) ?? puzzles[0] ?? null
  }, [puzzles, selectedPuzzleId])

  useEffect(() => {
    if (!puzzle || selectedPuzzleId === puzzle.id) {
      return
    }

    setSelectedPuzzleId(puzzle.id)
  }, [puzzle, selectedPuzzleId])

  useEffect(() => {
    if (!puzzle) {
      return
    }

    setVisitedIndexes([0])
    setTraceActive(false)
    setPointerPosition(null)
  }, [puzzle])

  useEffect(() => {
    if (!boardRef.current) {
      return
    }

    const element = boardRef.current
    const updateSize = () => {
      setBoardSize({
        width: element.clientWidth,
        height: element.clientHeight,
      })
    }

    updateSize()

    const observer = new ResizeObserver(() => {
      updateSize()
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storedValue = window.localStorage.getItem(CONNECT_DOTS_MUSIC_MUTED_KEY)
    if (storedValue === 'true') {
      setMusicMuted(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(CONNECT_DOTS_MUSIC_MUTED_KEY, String(musicMuted))
  }, [musicMuted])

  useEffect(() => {
    return () => {
      if (wrongClickTimeoutRef.current) {
        window.clearTimeout(wrongClickTimeoutRef.current)
      }

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        activeMusicUrlRef.current = null
      }

      if (successAudioRef.current) {
        successAudioRef.current.pause()
        successAudioRef.current.src = ''
      }
    }
  }, [])

  const completedCount = visitedIndexes.length
  const totalDots = puzzle?.dots.length ?? 0
  const finished = !!puzzle && completedCount >= totalDots
  const currentIndex = visitedIndexes[visitedIndexes.length - 1] ?? 0
  const nextIndex = currentIndex + 1
  const revealOpacity = revealMode === 'complete' ? (finished ? 1 : 0) : getRevealOpacity(completedCount, totalDots)

  const segments = useMemo(() => {
    if (!puzzle) {
      return []
    }

    return visitedIndexes.slice(1).map((visitedIndex) => {
      const from = puzzle.dots[visitedIndex - 1]
      const to = puzzle.dots[visitedIndex]

      return { from, to, key: `${visitedIndex - 1}-${visitedIndex}` }
    })
  }, [puzzle, visitedIndexes])

  const expectedDot = puzzle?.dots[nextIndex] ?? null
  const currentDot = puzzle?.dots[currentIndex] ?? null
  const renderRect = getContainedImageRect(
    boardSize.width,
    boardSize.height,
    puzzle?.imageWidth,
    puzzle?.imageHeight,
  )
  const svgWidth = Math.max(renderRect.width, 1)
  const svgHeight = Math.max(renderRect.height, 1)

  useEffect(() => {
    if (!finished) {
      setSuccessBurstVisible(false)
      if (successAudioRef.current) {
        successAudioRef.current.pause()
        successAudioRef.current.currentTime = 0
      }
      return
    }

    setSuccessBurstVisible(true)
    void (async () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }

      let unlocked = audioUnlockedRef.current
      if (!unlocked) {
        if (!audioRef.current) {
          audioRef.current = new Audio()
          audioRef.current.preload = 'auto'
          audioRef.current.loop = true
          audioRef.current.volume = CONNECT_DOTS_MUSIC_VOLUME
        }

        try {
          audioRef.current.src = SILENT_AUDIO_DATA_URI
          audioRef.current.muted = true
          audioRef.current.currentTime = 0

          const started = audioRef.current.play()
          if (started && typeof started.then === 'function') {
            await started
          }

          audioUnlockedRef.current = true
          audioRef.current.pause()
          audioRef.current.currentTime = 0
          unlocked = true
        } catch {
          audioUnlockedRef.current = false
          unlocked = false
        } finally {
          if (audioRef.current) {
            audioRef.current.muted = false

            if (activeMusicUrlRef.current && audioRef.current.src !== activeMusicUrlRef.current) {
              audioRef.current.src = activeMusicUrlRef.current
            }
          }
        }
      }

      if (!unlocked || musicMuted) {
        return
      }

      if (!successAudioRef.current) {
        successAudioRef.current = new Audio()
        successAudioRef.current.preload = 'auto'
        successAudioRef.current.loop = false
        successAudioRef.current.volume = CONNECT_DOTS_SUCCESS_VOLUME
        successAudioRef.current.src = CONNECT_DOTS_SUCCESS_AUDIO_URL
      }

      const audioEl = successAudioRef.current
      audioEl.currentTime = 0

      const started = audioEl.play()
      if (started && typeof started.catch === 'function') {
        await started.catch(() => undefined)
      }
    })()

    const timeout = window.setTimeout(() => {
      setSuccessBurstVisible(false)
    }, 2600)

    return () => {
      window.clearTimeout(timeout)

      if (successAudioRef.current) {
        successAudioRef.current.pause()
        successAudioRef.current.currentTime = 0
      }
    }
  }, [finished, musicMuted])

  const ensureAudioElement = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'auto'
      audioRef.current.loop = true
      audioRef.current.volume = CONNECT_DOTS_MUSIC_VOLUME
    }

    return audioRef.current
  }

  const pauseBackgroundMusic = (clearSource = false) => {
    const audioEl = audioRef.current
    if (!audioEl) {
      return
    }

    audioEl.pause()

    if (clearSource) {
      audioEl.src = ''
      activeMusicUrlRef.current = null
    }
  }

  const pauseSuccessAudio = (resetTime = false) => {
    const audioEl = successAudioRef.current
    if (!audioEl) {
      return
    }

    audioEl.pause()

    if (resetTime) {
      audioEl.currentTime = 0
    }
  }

  const ensureAudioUnlocked = async () => {
    const audioEl = ensureAudioElement()
    if (audioUnlockedRef.current) {
      return true
    }

    try {
      audioEl.src = SILENT_AUDIO_DATA_URI
      audioEl.muted = true
      audioEl.currentTime = 0

      const started = audioEl.play()
      if (started && typeof started.then === 'function') {
        await started
      }

      audioUnlockedRef.current = true
      audioEl.pause()
      audioEl.currentTime = 0
    } catch {
      audioUnlockedRef.current = false
    } finally {
      audioEl.muted = false

      if (activeMusicUrlRef.current && audioEl.src !== activeMusicUrlRef.current) {
        audioEl.src = activeMusicUrlRef.current
      }
    }

    return audioUnlockedRef.current
  }

  const playBackgroundMusic = async (url: string) => {
    if (musicMuted) {
      return
    }

    const audioEl = ensureAudioElement()
    audioEl.loop = true
    audioEl.volume = CONNECT_DOTS_MUSIC_VOLUME

    if (activeMusicUrlRef.current !== url) {
      activeMusicUrlRef.current = url
      audioEl.src = url
      audioEl.currentTime = 0
    }

    const started = audioEl.play()
    if (started && typeof started.catch === 'function') {
      await started.catch(() => undefined)
    }
  }

  const primeBackgroundMusic = async () => {
    if (!puzzle?.backgroundMusicUrl || musicMuted) {
      return
    }

    const unlocked = await ensureAudioUnlocked()
    if (!unlocked) {
      return
    }

    await playBackgroundMusic(puzzle.backgroundMusicUrl)
  }

  const handleMusicToggle = async () => {
    if (!puzzle?.backgroundMusicUrl) {
      return
    }

    if (musicMuted) {
      setMusicMuted(false)

      const unlocked = await ensureAudioUnlocked()
      if (!unlocked) {
        return
      }

      await playBackgroundMusic(puzzle.backgroundMusicUrl)
      return
    }

    setMusicMuted(true)
    pauseSuccessAudio(true)
  }

  const restart = () => {
    setVisitedIndexes([0])
    setTraceActive(false)
    setPointerPosition(null)
    setWrongClickFlashVisible(false)
  }

  const undo = () => {
    if (visitedIndexes.length <= 1) {
      return
    }

    setVisitedIndexes((current) => current.slice(0, -1))
    setTraceActive(false)
    setPointerPosition(null)
    setWrongClickFlashVisible(false)
  }

  useEffect(() => {
    if (!puzzle?.backgroundMusicUrl) {
      pauseBackgroundMusic(true)
      return
    }

    if (musicMuted) {
      pauseBackgroundMusic(false)
      pauseSuccessAudio(true)
      return
    }

    if (finished) {
      pauseBackgroundMusic(false)
      return
    }

    if (audioUnlockedRef.current) {
      const audioEl = ensureAudioElement()
      audioEl.loop = true
      audioEl.volume = CONNECT_DOTS_MUSIC_VOLUME

      if (activeMusicUrlRef.current !== puzzle.backgroundMusicUrl) {
        activeMusicUrlRef.current = puzzle.backgroundMusicUrl
        audioEl.src = puzzle.backgroundMusicUrl
        audioEl.currentTime = 0
      }

      const started = audioEl.play()
      if (started && typeof started.catch === 'function') {
        void started.catch(() => undefined)
      }
    }
  }, [finished, musicMuted, puzzle?.backgroundMusicUrl])

  const advanceTo = (index: number) => {
    if (!puzzle) {
      return
    }

    setVisitedIndexes((current) => {
      const currentIndex = current[current.length - 1] ?? 0

      if (current.length >= puzzle.dots.length || index !== currentIndex + 1 || current.includes(index)) {
        return current
      }

      return [...current, index]
    })
  }

  const triggerWrongClickFeedback = () => {
    setWrongClickFlashVisible(true)

    if (wrongClickTimeoutRef.current) {
      window.clearTimeout(wrongClickTimeoutRef.current)
    }

    wrongClickTimeoutRef.current = window.setTimeout(() => {
      setWrongClickFlashVisible(false)
      wrongClickTimeoutRef.current = null
    }, 320)
  }

  const getBoardPosition = (event: ReactPointerEvent<HTMLDivElement>): PointerPosition | null => {
    if (!boardRef.current) {
      return null
    }

    const bounds = boardRef.current.getBoundingClientRect()
    return getNormalizedPointFromContainedRect({
      bounds,
      clientX: event.clientX,
      clientY: event.clientY,
      rect: renderRect,
    })
  }

  const handleTraceStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    void primeBackgroundMusic()

    if (!puzzle || interactionMode !== 'trace' || !currentDot) {
      return
    }

    event.preventDefault()

    const position = getBoardPosition(event)
    if (!position) {
      return
    }

    setPointerPosition(position)

    if (distanceBetweenPoints(position, currentDot) > TRACE_RADIUS) {
      return
    }

    boardRef.current?.setPointerCapture(event.pointerId)
    setTraceActive(true)
  }

  const handleTraceMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!puzzle || interactionMode !== 'trace') {
      return
    }

    event.preventDefault()

    const position = getBoardPosition(event)
    if (!position) {
      return
    }

    setPointerPosition(position)

    if (!traceActive || !expectedDot || finished) {
      return
    }

    if (distanceBetweenPoints(position, expectedDot) <= TRACE_RADIUS) {
      advanceTo(nextIndex)
    }
  }

  const handleTraceEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionMode === 'trace') {
      event.preventDefault()
    }

    if (interactionMode === 'trace' && boardRef.current?.hasPointerCapture(event.pointerId)) {
      boardRef.current?.releasePointerCapture?.(event.pointerId)
    }

    setTraceActive(false)
    setPointerPosition(null)
  }

  const handleBoardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (interactionMode !== 'click' || finished) {
      return
    }

    const target = event.target as HTMLElement
    if (target.closest('[data-connect-dot="true"]')) {
      return
    }

    triggerWrongClickFeedback()
  }

  if (!puzzle) {
    return null
  }

  const imageAspectRatio =
    puzzle.imageWidth && puzzle.imageHeight ? `${puzzle.imageWidth} / ${puzzle.imageHeight}` : '4 / 3'

  return (
    <div className={cn('space-y-5', embedded && 'space-y-4')}>
      {showPicker && puzzles.length > 1 && (
        <div className="rounded-[2rem] border border-sky-100 bg-[linear-gradient(135deg,rgba(240,249,255,0.95),rgba(255,255,255,0.98))] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="block text-sm font-semibold text-slate-800">Vali pilt</div>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                {puzzles.length} valikut
              </p>
            </div>
            <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
              {puzzle.dots.length} punkti
            </div>
          </div>

          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-3 pb-3">
              {puzzles.map((entry) => {
                const active = entry.id === puzzle.id

                return (
                  <Card
                    key={entry.id}
                    className={cn(
                      'w-[120px] min-w-[120px] cursor-pointer overflow-hidden rounded-[1.4rem] border bg-white/92 p-0 shadow-sm transition-all duration-200',
                      active
                        ? 'border-sky-400 shadow-[0_16px_36px_-24px_rgba(14,165,233,0.85)] ring-2 ring-sky-200'
                        : 'border-slate-200 hover:border-sky-200 hover:shadow-[0_12px_30px_-24px_rgba(14,165,233,0.65)]',
                    )}
                    onClick={() =>
                      startTransition(() => {
                        setSelectedPuzzleId(entry.id)
                      })
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        startTransition(() => {
                          setSelectedPuzzleId(entry.id)
                        })
                      }
                    }}
                  >
                    <div className="relative h-[100px] w-full overflow-hidden bg-[radial-gradient(circle_at_top,#f8fafc,#e2e8f0)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={entry.imageAlt || entry.title}
                        className="h-full w-full object-contain"
                        draggable={false}
                        src={entry.imageUrl}
                      />
                      <div className="absolute right-2 top-2 rounded-full bg-white/92 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                        {entry.dots.length}
                      </div>
                    </div>
                    <div className="space-y-1 px-3 py-2">
                      <div className="line-clamp-2 text-sm font-semibold leading-5 text-slate-800">
                        {entry.title}
                      </div>
                      <div
                        className={cn(
                          'text-[11px] font-medium',
                          active ? 'text-sky-600' : 'text-slate-400',
                        )}
                      >
                        {active ? 'Praegu valitud' : 'Vali pilt'}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {puzzle.description ? (
            <p className="mt-3 text-sm text-slate-600">{puzzle.description}</p>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[2rem] border border-sky-100 bg-white p-3 shadow-[0_24px_80px_-40px_rgba(14,116,144,0.45)]">
          <div
            ref={boardRef}
            className="group relative min-h-[360px] select-none overflow-hidden rounded-[1.6rem] border border-sky-100 bg-[radial-gradient(circle_at_top,#f0f9ff,white_60%)] touch-none"
            style={{
              aspectRatio: imageAspectRatio,
              cursor: !finished ? PENCIL_CURSOR : 'default',
            }}
            onClick={handleBoardClick}
            onPointerDown={handleTraceStart}
            onPointerMove={handleTraceMove}
            onPointerLeave={() => {
              if (!traceActive) {
                setPointerPosition(null)
              }
            }}
            onPointerUp={handleTraceEnd}
            role="presentation"
          >
            <div
              className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-150"
              style={{
                backgroundColor: '#ef4444',
                opacity: wrongClickFlashVisible ? 0.32 : 0,
              }}
            />
            <div
              className="absolute select-none transition-[inset,width,height] duration-150"
              style={{
                height: renderRect.height,
                left: renderRect.left,
                top: renderRect.top,
                width: renderRect.width,
              }}
            >
              {/* next/image fill breaks containment in this layered game board. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={puzzle.imageAlt || puzzle.title}
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-500"
                draggable={false}
                src={puzzle.imageUrl}
                style={{ opacity: revealOpacity }}
              />

              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.02))]" />

              <svg
                className="absolute inset-0 h-full w-full select-none"
                preserveAspectRatio="none"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              >
                {segments.map((segment) => (
                  <line
                    key={segment.key}
                    stroke="rgba(0, 0, 0, 0.52)"
                    strokeLinecap="round"
                    strokeWidth="7"
                    x1={segment.from.x * svgWidth}
                    x2={segment.to.x * svgWidth}
                    y1={segment.from.y * svgHeight}
                    y2={segment.to.y * svgHeight}
                  />
                ))}

                {traceActive && currentDot && pointerPosition && !finished ? (
                  <line
                    stroke="rgba(0, 0, 0, 0.38)"
                    strokeDasharray="18 16"
                    strokeLinecap="round"
                    strokeWidth="5"
                    x1={currentDot.x * svgWidth}
                    x2={pointerPosition.x * svgWidth}
                    y1={currentDot.y * svgHeight}
                    y2={pointerPosition.y * svgHeight}
                  />
                ) : null}

                {puzzle.dots.map((dot, index) => {
                  const isStart = index === 0
                  const visited = visitedIndexes.includes(index)
                  const next = index === nextIndex && !finished
                  const label = getConnectDotsLabel(countMode, index)
                  const dotX = dot.x * svgWidth
                  const dotY = dot.y * svgHeight

                  return (
                    <g
                      key={`${puzzle.id}-${index}`}
                      data-connect-dot="true"
                      onClick={() => {
                        void primeBackgroundMusic()
                        if (interactionMode === 'click') {
                          if (index === nextIndex) {
                            advanceTo(index)
                          } else {
                            triggerWrongClickFeedback()
                          }
                        }
                      }}
                    >
                      <circle cx={dotX} cy={dotY} fill="transparent" r="18" />
                      {isStart ? (
                        <circle
                          cx={dotX}
                          cy={dotY}
                          fill="none"
                          r="11"
                          stroke="rgba(17, 24, 39, 0.38)"
                          strokeWidth="1.5"
                        />
                      ) : null}
                      <circle
                        cx={dotX}
                        cy={dotY}
                        fill={visited ? 'rgba(0, 0, 0, 0.18)' : '#ffffff'}
                        r="8"
                        stroke="#111827"
                        strokeWidth={next ? '3' : '2'}
                      />
                      {next ? <circle cx={dotX} cy={dotY} fill="#111827" r="2.2" /> : null}
                      <text
                        fill="#0f172a"
                        fontFamily="ui-sans-serif, system-ui, sans-serif"
                        fontSize="11"
                        fontWeight="700"
                        x={dotX + 12}
                        y={dotY - 10}
                      >
                        {label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            {finished ? (
              successBurstVisible ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Success animation"
                    className="h-[32rem] w-[32rem] object-contain drop-shadow-[0_24px_48px_rgba(15,23,42,0.3)] animate-[successGifIn_2.6s_cubic-bezier(0.18,0.9,0.2,1)_1]"
                    draggable={false}
                    src="/success.gif"
                  />
                </div>
              ) : (
                <Button
                  aria-label="Alusta uuesti"
                  className="absolute left-5 top-5 h-12 w-12 rounded-full bg-white/90 p-0 text-slate-700 shadow-md hover:bg-white"
                  onClick={restart}
                  size="icon"
                  title="Alusta uuesti"
                  variant="outline"
                >
                  <RefreshCw className="h-5 w-5" />
                </Button>
              )
            ) : null}
            {puzzle.backgroundMusicUrl ? (
              <Button
                aria-label={musicMuted ? 'Lülita muusika sisse' : 'Vaigista muusika'}
                className="absolute right-5 top-5 z-20 h-12 w-12 rounded-full bg-white/92 p-0 text-slate-700 shadow-md backdrop-blur-sm hover:bg-white"
                onClick={() => void handleMusicToggle()}
                size="icon"
                title={musicMuted ? 'Lülita muusika sisse' : 'Vaigista muusika'}
                variant="outline"
              >
                {musicMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
            ) : null}
            <style jsx>{`
              @keyframes successGifIn {
                0% {
                  opacity: 0;
                  transform: scale(0.28) translateY(24px);
                }
                16% {
                  opacity: 1;
                  transform: scale(1.18) translateY(-10px);
                }
                42% {
                  opacity: 1;
                  transform: scale(1.34) translateY(0);
                }
                70% {
                  opacity: 1;
                  transform: scale(1.22) translateY(0);
                }
                100% {
                  opacity: 0;
                  transform: scale(1.08) translateY(-6px);
                }
              }
            `}</style>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-800">
              <Eye className="h-4 w-4 text-sky-500" />
              <h2 className="text-sm font-semibold">Pildi ilmumine</h2>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {revealMode === 'complete'
                ? 'Pilt jääb peitu kuni kõik punktid on ühendatud.'
                : 'Iga õige ühendus teeb taustapildi selgemaks. Lõpus on kogu pilt nähtav.'}
            </p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#0ea5e9,#22c55e)] transition-[width] duration-300"
                style={{ width: `${Math.round((completedCount / Math.max(totalDots, 1)) * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
              <span>{puzzle.title}</span>
              <span>
                {completedCount}/{totalDots}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-800">
              <PencilLine className="h-4 w-4 text-sky-500" />
              <h2 className="text-sm font-semibold">Loendus</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {CONNECT_DOTS_COUNT_MODE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  className="rounded-full"
                  onClick={() => setCountMode(option.value)}
                  size="sm"
                  variant={countMode === option.value ? 'default' : 'outline'}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-800">
              <MousePointer2 className="h-4 w-4 text-sky-500" />
              <h2 className="text-sm font-semibold">Mänguviis</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {CONNECT_DOTS_INTERACTION_MODE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  className="rounded-full"
                  onClick={() => {
                    setInteractionMode(option.value)
                    setTraceActive(false)
                    setPointerPosition(null)
                  }}
                  size="sm"
                  variant={interactionMode === option.value ? 'default' : 'outline'}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-600">
              {interactionMode === 'click'
                ? 'Toksake alati järgmisel punktil.'
                : 'Alusta aktiivselt punktilt ja vea joon järgmise punktini.'}
            </p>
          </div>

          <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <Button className="gap-2 rounded-full" onClick={restart} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4" />
                Alusta uuesti
              </Button>
              <Button
                className="gap-2 rounded-full"
                disabled={visitedIndexes.length <= 1}
                onClick={undo}
                size="sm"
                variant="ghost"
              >
                <Undo2 className="h-4 w-4" />
                Samm tagasi
              </Button>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
              {finished ? (
                <span className="inline-flex items-center gap-2 font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Kõik punktid said ühendatud.
                </span>
              ) : (
                <>
                  Järgmine punkt:
                  <span className="ml-2 font-semibold text-slate-900">
                    {expectedDot ? getConnectDotsLabel(countMode, nextIndex) : 'Valmis'}
                  </span>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
