'use client'

import { Trash2, Undo2, Volume2 } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/utilities/ui'

type Word = { id: string; label: string; src: string }
// A word in the sentence bar. `key` is unique per tap, so a chip animates in once and keeps
// its identity when older words drop off the front.
type SentenceWord = Word & { key: number }
type QueuedWord = Word & { key?: number }

type SpeechState = {
  playingId: string | null
  hintId: string | null
  tap: (word: Word) => void
}

const SpeechContext = createContext<SpeechState | null>(null)

// Most words the sentence bar keeps; older ones drop off the front.
const MAX_SENTENCE_WORDS = 6

// A small working board like the one in the app: tapping a tile says the word and adds it
// to the bar at the bottom; the green button says the whole sentence.
export function SpeechBoard({ firstTileId, children }: { firstTileId?: string; children: ReactNode }) {
  // One audio element for the whole board, so a new tap stops the previous word.
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queueRef = useRef<QueuedWord[]>([])
  const nextKeyRef = useRef(0)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playingKey, setPlayingKey] = useState<number | null>(null)
  const [sentence, setSentence] = useState<SentenceWord[]>([])
  const [failed, setFailed] = useState(false)
  const [hinting, setHinting] = useState(false)
  const [tapped, setTapped] = useState(false)

  // Once the board scrolls into view, the first tile pulses a few times to invite a tap.
  useEffect(() => {
    const board = boardRef.current
    if (!board || !firstTileId) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHinting(true)
          observer.disconnect()
        }
      },
      { threshold: 0.6 },
    )
    observer.observe(board)
    return () => observer.disconnect()
  }, [firstTileId])

  const playNext = useCallback(() => {
    const audio = audioRef.current
    const next = queueRef.current.shift()
    if (!audio || !next) {
      setPlayingId(null)
      setPlayingKey(null)
      return
    }

    audio.src = next.src
    setPlayingId(next.id)
    setPlayingKey(next.key ?? null)
    audio.play().catch(() => {
      queueRef.current = []
      setPlayingId(null)
      setPlayingKey(null)
      setFailed(true)
    })
  }, [])

  const playWords = useCallback(
    (words: QueuedWord[]) => {
      let audio = audioRef.current
      if (!audio) {
        audio = new Audio()
        audio.preload = 'auto'
        audio.addEventListener('ended', () => playNext())
        audioRef.current = audio
      }

      audio.pause()
      queueRef.current = [...words]
      setFailed(false)
      // The first play() must start inside the tap handler for iPad Safari to allow sound;
      // later words in the queue reuse the same, already unlocked element.
      playNext()
    },
    [playNext],
  )

  const tap = useCallback(
    (word: Word) => {
      const key = nextKeyRef.current++
      setTapped(true)
      setSentence((current) => [...current, { ...word, key }].slice(-MAX_SENTENCE_WORDS))
      playWords([{ ...word, key }])
    },
    [playWords],
  )

  return (
    <SpeechContext.Provider value={{ playingId, hintId: hinting && !tapped ? (firstTileId ?? null) : null, tap }}>
      <div
        ref={boardRef}
        className="rounded-[34px] bg-[#22314c] p-2.5 shadow-[0_30px_70px_rgba(34,49,76,0.28)] sm:p-3"
      >
        <div className="rounded-[26px] bg-white p-3 sm:p-4">
          {children}

          <div className="mt-3 flex items-center gap-2 rounded-[18px] bg-[#f4f7fb] p-2 ring-1 ring-[#e6ebf3]">
            <ol aria-label="Lause" className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-1.5 px-1">
              {sentence.length ? (
                sentence.map((word) => (
                  <li
                    key={word.key}
                    className={cn(
                      'rounded-[10px] px-2.5 py-1 font-display text-base font-extrabold text-[#22314c] shadow-sm ring-1 transition-colors motion-safe:animate-chip-in',
                      playingKey === word.key ? 'bg-[#e9f8f1] ring-[#34b27b]' : 'bg-white ring-[#dfe5f0]',
                    )}
                  >
                    {word.label}
                  </li>
                ))
              ) : (
                <li className="text-sm font-semibold text-[#7a8499]">Puuduta pilte ja pane lause kokku</li>
              )}
            </ol>
            <button
              type="button"
              onClick={() => playWords(sentence)}
              disabled={!sentence.length}
              aria-label="Ütle lause"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#34b27b] text-white transition hover:bg-[#2a9a69] active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#34b27b]/35 disabled:opacity-40 motion-reduce:active:scale-100"
            >
              <Volume2 aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setSentence((current) => current.slice(0, -1))}
              disabled={!sentence.length}
              aria-label="Eemalda viimane sõna"
              className="flex h-11 w-9 flex-none items-center justify-center rounded-full text-[#56627a] transition hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1c79dd]/30 disabled:opacity-40"
            >
              <Undo2 aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setSentence([])}
              disabled={!sentence.length}
              aria-label="Tühjenda lause"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#ef4035] text-white transition hover:bg-[#d6352b] active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ef4035]/35 disabled:opacity-40 motion-reduce:active:scale-100"
            >
              <Trash2 aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-sm font-semibold text-[#bf1f2b]">
        {failed ? 'Heli ei käivitunud. Puuduta pilti uuesti.' : ''}
      </p>
    </SpeechContext.Provider>
  )
}

// Three bars that bounce while a tile is speaking.
function SoundBars({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('flex h-4 items-end gap-[3px]', className)}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-full w-[3px] origin-bottom rounded-full bg-current motion-safe:animate-sound-bar"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}

export function SpeakTile({
  id,
  src,
  label,
  borderClassName,
  playingClassName,
  barsClassName,
  children,
}: {
  id: string
  src: string | null
  label: string
  borderClassName: string
  playingClassName: string
  barsClassName: string
  children: ReactNode
}) {
  const speech = useContext(SpeechContext)
  const isPlaying = speech?.playingId === id
  const isHinted = speech?.hintId === id

  return (
    <button
      type="button"
      onClick={() => {
        if (src) speech?.tap({ id, label, src })
      }}
      disabled={!src}
      aria-label={`Ütle: ${label}`}
      className={cn(
        'relative flex w-full flex-col items-center gap-1.5 rounded-[16px] border-[3px] bg-white p-2 pb-2.5 text-center transition active:scale-[0.96] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1c79dd]/35 disabled:cursor-default motion-reduce:transition-none motion-reduce:active:scale-100',
        borderClassName,
        isPlaying && playingClassName,
        isHinted && 'motion-safe:animate-tile-hint',
      )}
    >
      {isPlaying ? <SoundBars className={cn('absolute right-2.5 top-2.5', barsClassName)} /> : null}
      {children}
      <span className="font-display text-base font-extrabold text-[#22314c] sm:text-lg">{label}</span>
    </button>
  )
}
