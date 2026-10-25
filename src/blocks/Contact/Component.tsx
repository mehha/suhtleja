import React from 'react'
import { Home, Mail, MessageSquareHeart, Phone, School } from 'lucide-react'

import { LogoTile } from '@/components/Brand'
import type { ContactBlock as ContactProps } from '@/payload-types'
import { cn } from '@/utilities/ui'

import { CopyButton } from './CopyButton'

type Props = ContactProps & {
  className?: string
}

const topicIcons = [Home, School, MessageSquareHeart]

function mailtoHref(email: string, subject?: string | null) {
  return subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`
}

export const ContactBlock: React.FC<Props> = ({ className, intro, email, phone, responseNote, topics, company }) => {
  const companyLine = [
    company?.name,
    company?.regCode ? `registrikood ${company.regCode}` : null,
    company?.address,
  ].filter(Boolean)

  return (
    <section className={cn('py-10 text-[#22314c] sm:py-12', className)}>
      <div className="mx-auto grid max-w-7xl items-start gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-8">
        <div>
          {intro ? <p className="max-w-xl text-pretty text-lg leading-8 text-[#56627a]">{intro}</p> : null}

          <div className="mt-8 grid gap-6">
            <div>
              <a
                href={mailtoHref(email)}
                className="inline-flex items-center gap-3 break-all font-display text-2xl font-black text-[#22314c] underline-offset-[6px] hover:underline sm:text-[2rem]"
              >
                <Mail aria-hidden="true" className="h-7 w-7 flex-none text-[#1c79dd]" />
                {email}
              </a>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CopyButton value={email} />
                {responseNote ? <p className="text-sm font-semibold text-[#56627a]">{responseNote}</p> : null}
              </div>
            </div>

            {phone ? (
              <a
                href={`tel:${phone.replace(/[^+\d]/g, '')}`}
                className="inline-flex items-center gap-3 self-start font-display text-xl font-extrabold text-[#22314c] underline-offset-[6px] hover:underline sm:text-2xl"
              >
                <Phone aria-hidden="true" className="h-6 w-6 flex-none text-[#1c79dd]" />
                {phone}
              </a>
            ) : null}
          </div>
        </div>

        {topics?.length ? (
          <ul className="grid gap-10">
            {topics.map((topic, index) => {
              const Icon = topicIcons[index % topicIcons.length]

              return (
                <li key={topic.id ?? index} className="flex gap-5">
                  <LogoTile index={index}>
                    <Icon />
                  </LogoTile>
                  <div>
                    <h2 className="font-display text-xl font-extrabold">{topic.title}</h2>
                    <p className="mt-1.5 text-base leading-7 text-[#56627a]">{topic.description}</p>
                    <a
                      href={mailtoHref(email, topic.subject)}
                      className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#22314c] px-5 text-sm font-semibold text-white transition hover:bg-[#172238] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22314c] focus-visible:ring-offset-2 motion-reduce:active:scale-100"
                    >
                      {topic.buttonLabel || 'Kirjuta meile'}
                    </a>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      {companyLine.length ? (
        <p className="mx-auto mt-16 max-w-7xl border-t border-[#e6ebf3] px-4 pt-6 text-sm text-[#657189] sm:px-6 lg:px-8">
          {companyLine.join(' · ')}
        </p>
      ) : null}
    </section>
  )
}
