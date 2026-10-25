import Link from 'next/link'
import { Home, MessageCircle, School, Users } from 'lucide-react'

import { LogoTile, SectionIntro, toneAt } from '@/components/Brand'
import type { SuhtlejaHomepageBlock } from '@/payload-types'
import { cn } from '@/utilities/ui'

import { homepageDefaults, rowsOr, textOr } from '../defaults'

const cardIcons = [Home, School, MessageCircle, Users]

export function AudienceSection({ audience }: { audience: SuhtlejaHomepageBlock['audience'] }) {
  const cards = rowsOr(audience?.cards, homepageDefaults.audience.cards)

  return (
    <div className="bg-[#f8fafc] py-20 sm:py-24" id="kellele">
      <div className="mx-auto max-w-7xl px-4">
        <SectionIntro
          eyebrow={textOr(audience?.eyebrow, homepageDefaults.audience.eyebrow)}
          title={audience?.title}
          description={audience?.description}
          tone="red"
        />

        <ul className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
          {cards.map((card, index) => {
            const Icon = cardIcons[index % cardIcons.length]

            return (
              <li key={`${index}-${card.title}`} className="flex max-w-sm flex-col">
                <LogoTile index={index} size="lg">
                  <Icon />
                </LogoTile>
                <h3 className="mt-6 font-display text-2xl font-extrabold">{card.title}</h3>
                <p className="mt-3 text-base leading-7 text-[#56627a]">{card.description}</p>
                {card.link?.href && card.link.label ? (
                  <Link
                    href={card.link.href}
                    className={cn(
                      'mt-5 self-start text-base font-bold underline decoration-2 underline-offset-[6px] hover:decoration-[3px] focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-current',
                      toneAt(index).text,
                    )}
                  >
                    {card.link.label}
                  </Link>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
