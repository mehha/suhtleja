import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/utilities/ui'

// Logo tile colours in logo order (smile, heart, house), then green. Sections cycle through
// them by position, so cards, tabs and icons in the same position share a colour.
const tones = [
  {
    solid: 'bg-[#ff980d]',
    soft: 'bg-[#fff4e5]',
    text: 'text-[#b35c00]',
    ring: 'ring-[#ff980d]',
    border: 'border-[#ff980d]',
    tile: 'bg-gradient-to-br from-[#ffbb2e] via-[#ff980d] to-[#ec6c05] shadow-[0_7px_16px_rgba(236,108,5,0.32)]',
    activeTab: 'data-[state=active]:border-[#ff980d] data-[state=active]:bg-[#fff4e5]',
  },
  {
    solid: 'bg-[#ef4035]',
    soft: 'bg-[#fdecea]',
    text: 'text-[#bf1f2b]',
    ring: 'ring-[#ef4035]',
    border: 'border-[#ef4035]',
    tile: 'bg-gradient-to-br from-[#ff7668] via-[#ef4035] to-[#bf1f2b] shadow-[0_7px_16px_rgba(191,31,43,0.28)]',
    activeTab: 'data-[state=active]:border-[#ef4035] data-[state=active]:bg-[#fdecea]',
  },
  {
    solid: 'bg-[#1c79dd]',
    soft: 'bg-[#eaf3fd]',
    text: 'text-[#1359b7]',
    ring: 'ring-[#1c79dd]',
    border: 'border-[#1c79dd]',
    tile: 'bg-gradient-to-br from-[#29a1f7] via-[#1c79dd] to-[#1359b7] shadow-[0_7px_16px_rgba(19,89,183,0.3)]',
    activeTab: 'data-[state=active]:border-[#1c79dd] data-[state=active]:bg-[#eaf3fd]',
  },
  {
    solid: 'bg-[#34b27b]',
    soft: 'bg-[#e9f8f1]',
    text: 'text-[#19724f]',
    ring: 'ring-[#34b27b]',
    border: 'border-[#34b27b]',
    tile: 'bg-gradient-to-br from-[#5fd39f] via-[#34b27b] to-[#19724f] shadow-[0_7px_16px_rgba(25,114,79,0.28)]',
    activeTab: 'data-[state=active]:border-[#34b27b] data-[state=active]:bg-[#e9f8f1]',
  },
] as const

export type Tone = (typeof tones)[number]

export function toneAt(index: number): Tone {
  return tones[index % tones.length]
}

// The logo's tiles lean slightly; repeat the same tilts.
const tileTilts = ['-rotate-2', 'rotate-2', 'rotate-0', '-rotate-1']

const tileSizes = {
  sm: 'h-7 w-7 rounded-[7px] [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-12 w-12 rounded-[13px] [&_svg]:h-6 [&_svg]:w-6',
  lg: 'h-16 w-16 rounded-[17px] text-2xl [&_svg]:h-8 [&_svg]:w-8',
}

export function LogoTile({
  index,
  size = 'md',
  children,
}: {
  index: number
  size?: keyof typeof tileSizes
  children: ReactNode
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative flex flex-none items-center justify-center font-display font-black text-white',
        toneAt(index).tile,
        tileTilts[index % tileTilts.length],
        tileSizes[size],
      )}
    >
      {children}
    </span>
  )
}

export function Eyebrow({ children, tone = 'blue' }: { children?: string | null; tone?: 'orange' | 'red' | 'blue' }) {
  if (!children) return null

  const color = tone === 'orange' ? 'bg-[#ff980d]' : tone === 'red' ? 'bg-[#ef4035]' : 'bg-[#1c79dd]'

  return (
    <p className="inline-flex items-center gap-2 text-sm font-bold text-[#56627a]">
      <span className={cn('h-3 w-3 -rotate-6 rounded-[3px]', color)} />
      {children}
    </p>
  )
}

export function SectionIntro({
  eyebrow,
  title,
  description,
  tone,
  className,
  as: Heading = 'h2',
}: {
  eyebrow?: string | null
  title?: string | null
  description?: string | null
  tone?: 'orange' | 'red' | 'blue'
  className?: string
  as?: 'h1' | 'h2'
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      {title ? (
        <Heading className="mt-3 text-balance font-display text-[2rem] font-black leading-[1.08] tracking-[-0.01em] sm:text-[2.6rem]">
          {title}
        </Heading>
      ) : null}
      {description ? <p className="mt-5 text-pretty text-lg leading-8 text-[#56627a]">{description}</p> : null}
    </div>
  )
}

export function ButtonLink({
  href,
  label,
  variant = 'primary',
}: {
  href?: string | null
  label?: string | null
  variant?: 'primary' | 'secondary'
}) {
  if (!href || !label) return null

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base font-semibold transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:active:scale-100',
        variant === 'primary'
          ? 'bg-[#22314c] text-white shadow-[0_14px_32px_rgba(34,49,76,0.22)] hover:bg-[#172238] focus-visible:ring-[#22314c]'
          : 'border-2 border-[#d8dde8] bg-white text-[#22314c] hover:border-[#22314c]/40 focus-visible:ring-[#1c79dd]',
      )}
    >
      {label}
    </Link>
  )
}
