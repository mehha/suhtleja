import type { ReactNode } from 'react'

import { Media } from '@/components/Media'
import type { Media as PayloadMedia } from '@/payload-types'
import { cn } from '@/utilities/ui'

export type MediaResource = PayloadMedia | number | null | undefined

export function isMediaObject(resource: MediaResource): resource is PayloadMedia {
  return Boolean(resource && typeof resource === 'object')
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
