// src/blocks/AacFeatures/Component.tsx
import React from 'react'
import type { AacFeaturesBlock as AacFeaturesProps } from 'src/payload-types'
import { LogoTile, SectionIntro } from '@/components/Brand'
import { cn } from '@/utilities/ui'
import {
  MessageCircle,
  Grid3X3,
  Images,
  Volume2,
  Share2,
  WifiOff,
  Rocket,
  Accessibility,
  Combine,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

type Props = {
  className?: string
  /** Render the title as the page's h1 (see `getPageTitleMode`). */
  promoteHeading?: boolean
} & AacFeaturesProps

const iconMap: Record<string, LucideIcon> = {
  'message-circle': MessageCircle,
  'grid-3x3': Grid3X3,
  images: Images,
  'volume-2': Volume2,
  'share-2': Share2,
  'wifi-off': WifiOff,
  rocket: Rocket,
  accessibility: Accessibility,
  combine: Combine,
  ai: Sparkles
}

export const AacFeaturesBlock: React.FC<Props> = ({
  className,
  eyebrow,
  title,
  subtitle,
  items,
  promoteHeading,
}) => {
  if (!items || items.length === 0) return null

  return (
    <section className={cn('py-20 text-[#22314c] sm:py-24', className)}>
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 sm:px-6 lg:px-8">
        <SectionIntro eyebrow={eyebrow} title={title} description={subtitle} as={promoteHeading ? 'h1' : 'h2'} />

        {/* Open layout on the page background; accent items get a pale panel with the same padding.
            The negative margin lines item content up with the heading above. */}
        <ul className="-mx-4 grid gap-x-6 gap-y-4 sm:-mx-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => {
            if (!item) return null
            const Icon =
              (item.icon && iconMap[item.icon]) ?? MessageCircle

            return (
              <li
                key={item.id ?? index}
                className={cn(
                  'flex flex-col rounded-[24px] p-4 sm:rounded-[28px] sm:p-6',
                  item.variant === 'accent' && 'bg-[#eaf3fd]',
                )}
              >
                <LogoTile index={index}>
                  <Icon />
                </LogoTile>
                {item.title && (
                  <h3 className="mt-6 font-display text-xl font-extrabold">
                    {item.title}
                  </h3>
                )}
                {item.description && (
                  <p className="mt-2 text-base leading-7 text-[#56627a]">
                    {item.description}
                  </p>
                )}
                {item.ctaLabel && item.ctaHref && (
                  <a
                    href={item.ctaHref}
                    className="mt-5 self-start text-base font-bold text-[#1359b7] underline decoration-2 underline-offset-[6px] hover:decoration-[3px] focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-current"
                  >
                    {item.ctaLabel}
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
