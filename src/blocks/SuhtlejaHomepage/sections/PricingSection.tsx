import Link from 'next/link'
import { Check } from 'lucide-react'

import { SectionIntro } from '@/components/Brand'
import type { SuhtlejaHomepageBlock } from '@/payload-types'

import { homepageDefaults, rowsOr, textOr } from '../defaults'

export function PricingSection({ pricing }: { pricing: SuhtlejaHomepageBlock['pricing'] }) {
  const d = homepageDefaults.pricing
  const includes = rowsOr(
    pricing?.includes?.map((item) => item.text),
    d.includes,
  )
  const ctaHref = textOr(pricing?.cta?.href, d.cta.href)
  const institutionsHref = textOr(pricing?.institutions?.href, d.institutions.href)

  return (
    <div className="bg-[#f8fafc] py-20 sm:py-24" id="hind">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 lg:grid-cols-2">
        <div>
          <SectionIntro
            eyebrow={textOr(pricing?.eyebrow, d.eyebrow)}
            title={textOr(pricing?.title, d.title)}
            description={textOr(pricing?.description, d.description)}
            tone="orange"
          />
          <p className="mt-8 text-base text-[#56627a]">
            {textOr(pricing?.institutions?.text, d.institutions.text)}{' '}
            <Link
              href={institutionsHref}
              className="font-bold text-[#1359b7] underline underline-offset-4 hover:text-[#22314c]"
            >
              {textOr(pricing?.institutions?.label, d.institutions.label)}
            </Link>
          </p>
        </div>

        <div className="mx-auto w-full max-w-md rounded-[32px] bg-white p-6 shadow-[0_24px_60px_rgba(34,49,76,0.12)] ring-1 ring-[#dfe5f0] sm:p-8 lg:mr-0">
          <p className="text-base font-bold text-[#56627a]">
            {textOr(pricing?.planName, d.planName)}
          </p>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-6xl font-black tracking-[-0.02em] text-[#22314c]">{textOr(pricing?.price, d.price)}</span>
            <span className="text-lg font-semibold text-[#56627a]">/ {textOr(pricing?.period, d.period)}</span>
          </p>

          <ul className="mt-6 grid gap-3 border-t border-[#e6ebf3] pt-6">
            {includes.map((text, index) => (
              <li key={`${index}-${text}`} className="flex items-start gap-3 text-base font-semibold text-[#344259]">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#eaf3fd] text-[#1c79dd]">
                  <Check aria-hidden="true" className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <Link
            href={ctaHref}
            className="mt-8 flex min-h-12 w-full items-center justify-center rounded-full bg-[#22314c] px-5 text-base font-semibold text-white shadow-[0_14px_32px_rgba(34,49,76,0.22)] transition hover:bg-[#172238] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22314c] focus-visible:ring-offset-2"
          >
            {textOr(pricing?.cta?.label, d.cta.label)}
          </Link>
          <p className="mt-4 text-center text-sm leading-6 text-[#657189]">{textOr(pricing?.note, d.note)}</p>
        </div>
      </div>
    </div>
  )
}
