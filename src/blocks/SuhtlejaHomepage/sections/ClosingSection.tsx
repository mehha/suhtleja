import { ButtonLink } from '@/components/Brand'
import type { SuhtlejaHomepageBlock } from '@/payload-types'

import { homepageDefaults, textOr } from '../defaults'

export function ClosingSection({ closing }: { closing: SuhtlejaHomepageBlock['closing'] }) {
  const d = homepageDefaults.closing

  return (
    <div className="bg-[#ff980d]">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="max-w-2xl">
          <h2 className="text-balance font-display text-[2rem] font-black leading-[1.08] tracking-[-0.01em] text-[#22314c] sm:text-[2.6rem]">
            {textOr(closing?.title, d.title)}
          </h2>
          <p className="mt-4 text-base leading-7 text-[#22314c]/85 sm:text-lg">
            {textOr(closing?.description, d.description)}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <ButtonLink href={textOr(closing?.cta?.href, d.cta.href)} label={textOr(closing?.cta?.label, d.cta.label)} />
          <p className="text-sm font-semibold text-[#22314c]/80">{textOr(closing?.note, d.note)}</p>
        </div>
      </div>
    </div>
  )
}
