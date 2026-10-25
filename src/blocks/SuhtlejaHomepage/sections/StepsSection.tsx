import { LogoTile, SectionIntro } from '@/components/Brand'
import { Reveal } from '@/components/Brand/Reveal'
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

        {/* A dashed line joins the numbered tiles, so the steps read as one path. When the steps
            scroll into view, they appear in order and each line draws on to the next step. */}
        <Reveal className="mt-14">
          <ol
            className={cn(
              'grid gap-10 md:gap-8',
              items.length === 4 ? 'md:grid-cols-4' : items.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3',
            )}
          >
            {items.map((item, index) => (
              <li key={`${index}-${item.title}`} className="relative">
                {index < items.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-6 left-[5.5rem] top-8 hidden origin-left border-t-[3px] border-dashed border-[#cfd7e4] group-data-[reveal=pending]/reveal:scale-x-0 group-data-[reveal=in]/reveal:animate-draw-x md:block"
                    style={{ animationDelay: `${index * 220 + 260}ms` }}
                  />
                ) : null}
                <div
                  className="group-data-[reveal=pending]/reveal:opacity-0 group-data-[reveal=in]/reveal:animate-pop-in"
                  style={{ animationDelay: `${index * 220}ms` }}
                >
                  <LogoTile index={index} size="lg">
                    {index + 1}
                  </LogoTile>
                  <h3 className="mt-6 font-display text-2xl font-extrabold">{item.title}</h3>
                  <p className="mt-3 text-base leading-7 text-[#56627a]">{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </div>
  )
}
