import Link from 'next/link'
import type { ReactNode } from 'react'

import { Media } from '@/components/Media'
import type { Media as PayloadMedia } from '@/payload-types'
import { cn } from '@/utilities/ui'

export type MediaResource = PayloadMedia | number | null | undefined

export function isMediaObject(resource: MediaResource): resource is PayloadMedia {
  return Boolean(resource && typeof resource === 'object')
}

export function ButtonLink({
  href,
  label,
  variant = 'primary',
}: {
  href?: string | null
  label?: string | null
  variant?: 'primary' | 'secondary'
}) {
  if (!href || !label) return null

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base font-semibold transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:active:scale-100',
        variant === 'primary'
          ? 'bg-[#22314c] text-white shadow-[0_14px_32px_rgba(34,49,76,0.22)] hover:bg-[#172238] focus-visible:ring-[#22314c]'
          : 'border-2 border-[#d8dde8] bg-white text-[#22314c] hover:border-[#22314c]/40 focus-visible:ring-[#1c79dd]',
      )}
    >
      {label}
    </Link>
  )
}

export function MediaFrame({
  resource,
  label,
  className,
  children,
  imageFit = 'cover',
}: {
  resource?: MediaResource
  label: string
  className?: string
  children?: ReactNode
  imageFit?: 'cover' | 'contain'
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[28px]',
        className,
      )}
    >
      {isMediaObject(resource) ? (
        <Media
          resource={resource}
          fill
          pictureClassName="block h-full w-full"
          imgClassName={imageFit === 'contain' ? 'object-contain' : 'object-cover'}
          videoClassName="h-full w-full object-cover"
        />
      ) : (
        children ?? (
          <div className="flex h-full min-h-64 items-center justify-center bg-[#f6f8fb] p-8 text-center text-sm font-semibold text-[#657189]">
            {label}
          </div>
        )
      )}
    </div>
  )
}
