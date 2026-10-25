import { Languages, MonitorSmartphone, Quote, ShieldCheck, Sparkles } from 'lucide-react'

import { LogoTile, SectionIntro } from '@/components/Brand'
import type { SuhtlejaHomepageBlock } from '@/payload-types'

import { homepageDefaults, rowsOr, textOr } from '../defaults'
import { ButtonLink } from '../ui'

const pointIcons = [Languages, ShieldCheck, MonitorSmartphone, Sparkles]

export function AboutSection({ about }: { about: SuhtlejaHomepageBlock['about'] }) {
  const points = rowsOr(about?.points, homepageDefaults.about.points)
  const testimonials = about?.testimonials ?? []

  return (
    <div className="py-20 sm:py-24" id="miks">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <SectionIntro
              eyebrow={textOr(about?.eyebrow, homepageDefaults.about.eyebrow)}
              title={textOr(about?.title, homepageDefaults.about.title)}
              description={textOr(about?.description, homepageDefaults.about.description)}
              tone="red"
            />
            <div className="mt-8">
              <ButtonLink
                href={textOr(about?.link?.href, homepageDefaults.about.link.href)}
                label={textOr(about?.link?.label, homepageDefaults.about.link.label)}
                variant="secondary"
              />
            </div>
          </div>

          <ul className="grid gap-9 lg:pt-2">
            {points.map((point, index) => {
              const Icon = pointIcons[index % pointIcons.length]

              return (
                <li key={`${index}-${point.title}`} className="flex gap-5">
                  <LogoTile index={index}>
                    <Icon />
                  </LogoTile>
                  <div>
                    <h3 className="font-display text-xl font-extrabold">{point.title}</h3>
                    <p className="mt-1.5 text-base leading-7 text-[#56627a]">{point.description}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {testimonials.length ? (
          <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <li key={testimonial.id ?? testimonial.name}>
                <figure className="flex h-full flex-col rounded-[24px] bg-[#f8fafc] p-6">
                  <Quote aria-hidden="true" className="h-7 w-7 text-[#ff980d]" />
                  <blockquote className="mt-4 flex-1 text-base leading-7 text-[#344259]">{testimonial.quote}</blockquote>
                  <figcaption className="mt-5 text-sm">
                    <span className="font-bold text-[#22314c]">{testimonial.name}</span>
                    {testimonial.role ? <span className="text-[#657189]">, {testimonial.role}</span> : null}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
