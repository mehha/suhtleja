import React from 'react'

import { ButtonLink, LogoTile, SectionIntro, toneAt } from '@/components/Brand'
import { Reveal } from '@/components/Brand/Reveal'
import { Media } from '@/components/Media'
import type { HowItWorksBlock as HowItWorksProps } from '@/payload-types'
import { cn } from '@/utilities/ui'

type Props = HowItWorksProps & {
  className?: string
  /** Render the title as the page's h1 (see `getPageTitleMode`). */
  promoteHeading?: boolean
}

type AspectRatio = NonNullable<NonNullable<HowItWorksProps['steps']>[number]['mediaAspectRatio']>

const aspectClass: Record<AspectRatio, string> = {
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
  '9/16': 'mx-auto aspect-[9/16] w-full max-w-sm',
}

// Shown on large screens until a step has its own screenshot: a small board in the logo colours.
function BoardPlaceholder({ index }: { index: number }) {
  return (
    <div className="grid h-full grid-cols-3 content-center gap-3 p-8">
      {Array.from({ length: 6 }, (_, cell) => (
        <span
          key={cell}
          className={cn('aspect-[4/3] rounded-[14px] border-[3px] bg-white opacity-70', toneAt(index + cell).border)}
        />
      ))}
    </div>
  )
}

export const HowItWorksBlock: React.FC<Props> = ({
  className,
  eyebrow,
  title,
  intro,
  steps,
  cta,
  promoteHeading,
}) => {
  const items = steps ?? []

  return (
    <section className={cn('py-12 text-[#22314c] sm:py-16', className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionIntro eyebrow={eyebrow} title={title} description={intro} as={promoteHeading ? 'h1' : 'h2'} />

        <ol className="mt-14 grid gap-16 lg:gap-20">
          {items.map((step, index) => {
            const media = step.media && typeof step.media === 'object' ? step.media : null
            const isVideo = Boolean(media?.mimeType?.includes('video'))

            return (
              <li key={step.id ?? index} className="relative">
                {/* A dashed line runs from each number down to the next, so the steps read as one path. */}
                {index < items.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-[4.5rem] left-8 top-[5.25rem] hidden border-l-[3px] border-dashed border-[#cfd7e4] lg:block"
                  />
                ) : null}

                <Reveal className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
                  {/* The number sits in its own column, so the dashed line below it never crosses the text. */}
                  <div className="flex gap-5 group-data-[reveal=pending]/reveal:opacity-0 group-data-[reveal=in]/reveal:animate-pop-in sm:gap-6">
                    <LogoTile index={index} size="lg">
                      {index + 1}
                    </LogoTile>
                    <div className="min-w-0 pt-1">
                      <h3 className="font-display text-2xl font-extrabold sm:text-[1.75rem]">{step.title}</h3>
                      <p className="mt-3 max-w-md text-lg leading-8 text-[#56627a]">{step.description}</p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      'relative overflow-hidden rounded-[28px] bg-[#f4f7fb] ring-1 ring-[#e6ebf3] group-data-[reveal=pending]/reveal:opacity-0 group-data-[reveal=in]/reveal:animate-fade-up',
                      aspectClass[step.mediaAspectRatio || '4/3'],
                      !media && 'hidden lg:block',
                    )}
                    style={{ animationDelay: '150ms' }}
                  >
                    {media ? (
                      <Media
                        resource={media}
                        fill={!isVideo}
                        pictureClassName="block h-full w-full"
                        imgClassName="object-contain"
                        videoClassName="h-full w-full bg-black object-contain"
                        videoAutoPlay={false}
                        videoControls
                      />
                    ) : (
                      <BoardPlaceholder index={index} />
                    )}
                  </div>
                </Reveal>
              </li>
            )
          })}
        </ol>

        {cta?.label && cta.href ? (
          <div className="mt-20 grid items-center gap-6 rounded-[32px] bg-[#ff980d] p-8 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto]">
            {cta.title ? (
              <h2 className="text-balance font-display text-[1.75rem] font-black leading-[1.1] text-[#22314c] sm:text-[2.2rem]">
                {cta.title}
              </h2>
            ) : null}
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <ButtonLink href={cta.href} label={cta.label} />
              {cta.note ? <p className="text-sm font-semibold text-[#22314c]/80">{cta.note}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
