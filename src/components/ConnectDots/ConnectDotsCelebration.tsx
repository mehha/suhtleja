'use client'

import type { CSSProperties } from 'react'

// Shown for a moment when a puzzle is completed: a confetti burst around "Tubli!". Drawn here
// rather than a GIF or a clip from somewhere else, so the app holds the rights to everything it shows.
const COLORS = ['#ff980d', '#1c79dd', '#e5484d', '#34b27b', '#f5c518', '#8e4ec6']

// A fixed spread (no Math.random) so server and client render the same pieces.
const PIECES = Array.from({ length: 30 }, (_, index) => {
  const angle = (index / 30) * Math.PI * 2 + (index % 4) * 0.12
  const distance = 130 + ((index * 53) % 110)

  return {
    color: COLORS[index % COLORS.length],
    delay: (index % 5) * 0.04,
    round: index % 3 === 0,
    rotate: (index * 67) % 360,
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance * 0.8 - 30),
  }
})

export function ConnectDotsCelebration() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status">
      <div className="relative">
        {PIECES.map((piece, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="connect-dots-confetti absolute left-1/2 top-1/2 block h-3.5 w-2.5 motion-reduce:hidden"
            style={
              {
                '--confetti-r': `${piece.rotate}deg`,
                '--confetti-x': `${piece.x}px`,
                '--confetti-y': `${piece.y}px`,
                animationDelay: `${piece.delay}s`,
                backgroundColor: piece.color,
                borderRadius: piece.round ? '9999px' : '2px',
              } as CSSProperties
            }
          />
        ))}
        <span className="connect-dots-cheer relative block rounded-full bg-white px-9 py-4 font-display text-5xl font-black text-[#22314c] shadow-[0_18px_42px_rgba(34,49,76,0.3)]">
          Tubli!
        </span>
      </div>
      <style>{`
        @keyframes connect-dots-confetti {
          0% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(0.4); }
          75% { opacity: 1; }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--confetti-x)), calc(-50% + var(--confetti-y) + 90px))
              rotate(var(--confetti-r)) scale(1);
          }
        }
        @keyframes connect-dots-cheer {
          0% { opacity: 0; transform: scale(0.3); }
          16% { opacity: 1; transform: scale(1.15); }
          28% { transform: scale(1); }
          85% { opacity: 1; }
          100% { opacity: 0; transform: scale(1); }
        }
        .connect-dots-confetti { animation: connect-dots-confetti 1.7s cubic-bezier(0.15, 0.8, 0.3, 1) both; }
        .connect-dots-cheer { animation: connect-dots-cheer 2.6s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .connect-dots-cheer { animation: none; }
        }
      `}</style>
    </div>
  )
}
