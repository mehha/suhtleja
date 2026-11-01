'use client'

import * as React from 'react'
import {
  MessageCircle,
  Mic,
  Headphones,
  Users,
  BookOpen,
  Brain,
  Smile,
  MousePointer,
  type LucideIcon,
} from 'lucide-react'
import type { Media as PayloadMedia } from '@/payload-types'
import { Media } from '@/components/Media'

export type HeroPawsCard = {
  title: string
  icon: keyof typeof ICONS
  image?: PayloadMedia | null // expects hydrated media doc (depth > 0)
  gradientFrom?: string
  gradientTo?: string
  labelBg?: string
  badges?: { label: string; icon?: keyof typeof ICONS }[]
}

export type HeroPawsClientProps = {
  eyebrow?: string
  title: string
  description?: string
  ctas?: { label: string; href: string; variant?: 'primary' | 'secondary' }[]
  cards: HeroPawsCard[]
}

// AAC-related Lucide icons
const ICONS = {
  MessageCircle, // suhtlus / rääkimine
  Mic,           // kõne / häälsüntees
  Headphones,    // kuulamine
  Users,         // suhtluspartnerid / grupp
  BookOpen,      // õppematerjalid / sõnavara
  Brain,         // kognitsioon / õppimine
  Smile,         // emotsioonid / tunded
  MousePointer,  // puudutamine / valimine (touch)
} satisfies Record<string, LucideIcon>

export const HeroPawsClient: React.FC<HeroPawsClientProps> = ({
  eyebrow = 'Eestikeelne AAC suhtlus',
  title,
  description,
  ctas = [],
  cards,
}) => {
  return (
    <section className="relative isolate overflow-hidden">
      {/* static floating icon pills – nüüd AAC-ikoonid */}
      <span
        className="absolute top-0 left-1/4 hidden p-3 items-center justify-center rounded-full bg-yellow-300 text-yellow-900 shadow ring-1 ring-black/5 backdrop-blur md:flex"
        aria-hidden="true"
      >
        <MessageCircle className="h-4 w-4" />
      </span>
      <span
        className="absolute top-10 right-24 hidden p-2 items-center justify-center rounded-full bg-orange-300 text-orange-900 shadow ring-1 ring-black/5 backdrop-blur md:flex"
        aria-hidden="true"
      >
        <Mic className="h-4 w-4" />
      </span>
      <span
        className="absolute top-1/2 left-24 hidden p-3 items-center justify-center rounded-full bg-blue-300 text-blue-900 shadow ring-1 ring-black/5 backdrop-blur md:flex"
        aria-hidden="true"
      >
        <Headphones className="h-5 w-5" />
      </span>
      <span
        className="absolute top-1/2 right-12 hidden p-2 items-center justify-center rounded-full bg-emerald-300 text-emerald-900 shadow ring-1 ring-black/5 backdrop-blur md:flex"
        aria-hidden="true"
      >
        <Users className="h-4 w-4" />
      </span>

      <div className="mx-auto max-w-6xl sm:px-6 pt-14 pb-10 text-center">
        <div className="mb-6 text-sm text-slate-600">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
          {eyebrow}
        </div>

        <h1
          className="mx-auto max-w-3xl text-balance text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl"
          dangerouslySetInnerHTML={{ __html: title }}
        />

        {description && (
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-7 text-slate-600 sm:text-lg">
            {description}
          </p>
        )}

        {!!ctas.length && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {ctas.map((c) =>
              c.variant !== 'secondary' ? (
                <a
                  key={c.label}
                  href={c.href}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/50"
                >
                  {c.label}
                  <span className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-pink-200 text-slate-900">
                    <MessageCircle size={16} />
                  </span>
                </a>
              ) : (
                <a
                  key={c.label}
                  href={c.href}
                  className="group inline-flex h-[52px] items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
                >
                  {c.label}
                  <svg
                    className="h-4 w-4 transition group-hover:translate-x-0.5"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 3l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              ),
            )}
          </div>
        )}
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:px-6 pb-16 sm:grid-cols-3">
        {cards.map((c, index) => {
          const Icon = ICONS[c.icon] || MessageCircle

          return (
            <div
              key={`${c.title}-${index}`}
              className="overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-slate-900/5"
            >
              <div
                className={[
                  'relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-b flex items-center justify-center',
                  c.gradientFrom ?? 'from-slate-100',
                  c.gradientTo ?? 'to-slate-200',
                ].join(' ')}
                aria-hidden="true"
              >
                {c.image && typeof c.image === 'object' && c.image?.url ? (
                  <Media
                    resource={c.image}
                    alt={c.image.alt || c.title}
                    fill
                    pictureClassName="block h-full w-full"
                    imgClassName="object-contain"
                    priority={false}
                  />
                ) : (
                  <Icon className="h-28 w-28 text-slate-900/80" />
                )}
              </div>
              <div className="relative -mt-8 px-4 pb-4">
                <div
                  className={[
                    'mx-auto w-fit rounded-full px-3 py-1.5 text-sm font-semibold text-white shadow',
                    c.labelBg ?? 'bg-slate-800',
                  ].join(' ')}
                >
                  {c.title}
                </div>
                {!!c.badges?.length && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-slate-600">
                    {c.badges.map((b) => {
                      const BIcon = (b.icon && ICONS[b.icon]) || Brain
                      return (
                        <span
                          key={b.label}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium shadow-sm"
                        >
                          <BIcon className="h-3.5 w-3.5" />
                          {b.label}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
