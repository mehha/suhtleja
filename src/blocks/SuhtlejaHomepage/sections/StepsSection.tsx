import { LogoTile, SectionIntro } from '@/components/Brand'
import type { SuhtlejaHomepageBlock } from '@/payload-types'
import { cn } from '@/utilities/ui'

import { homepageDefaults, rowsOr, textOr } from '../defaults'

export function StepsSection({ steps }: { steps: SuhtlejaHomepageBlock['steps'] }) {
  const items = rowsOr(steps?.items, homepageDefaults.steps.items)

  return (
    <div className="py-20 sm:py-24" id="alusta">
      <div className="mx-auto max-w-7xl px-4">
        <SectionIntro
          eyebrow={textOr(steps?.eyebrow, homepageDefaults.steps.eyebrow)}
          title={textOr(steps?.title, homepageDefaults.steps.title)}
        />

        {/* A dashed line joins the numbered tiles, so the steps read as one path. */}
        <ol
          className={cn(
            'mt-14 grid gap-10 md:gap-8',
            items.length === 4 ? 'md:grid-cols-4' : items.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3',
          )}
        >
          {items.map((item, index) => (
            <li
              key={`${index}-${item.title}`}
              className="relative md:after:absolute md:after:-right-6 md:after:left-[5.5rem] md:after:top-8 md:after:border-t-[3px] md:after:border-dashed md:after:border-[#cfd7e4] md:last:after:hidden"
            >
              <LogoTile index={index} size="lg">
                {index + 1}
              </LogoTile>
              <h3 className="mt-6 font-display text-2xl font-extrabold">{item.title}</h3>
              <p className="mt-3 text-base leading-7 text-[#56627a]">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
