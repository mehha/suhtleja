import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/utilities/ui'
import Link from 'next/link'
import React from 'react'

import type { Page, Post } from '@/payload-types'
import { Monitor, Sparkles } from 'lucide-react'

type CMSLinkType = {
  appearance?: 'inline' | ButtonProps['variant']
  children?: React.ReactNode
  className?: string
  label?: string | null
  onClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>
  newTab?: boolean | null
  accent?: 'board' | 'tools' | 'none' | null
  reference?: {
    relationTo: 'pages' | 'posts'
    value: Page | Post | string | number
  } | null
  size?: ButtonProps['size'] | null
  type?: 'custom' | 'reference' | null
  url?: string | null
}

export const CMSLink: React.FC<CMSLinkType> = (props) => {
  const {
    type,
    appearance = 'inline',
    children,
    className,
    label,
    onClick,
    newTab,
    accent,
    reference,
    size: sizeFromProps,
    url,
  } = props

  const href =
    type === 'reference' && typeof reference?.value === 'object' && reference.value.slug
      ? `${reference?.relationTo !== 'pages' ? `/${reference?.relationTo}` : ''}/${
          reference.value.slug
        }`
      : url

  if (!href) return null

  const size = appearance === 'link' ? 'clear' : sizeFromProps
  const newTabProps = newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}

  const accentStyles: Record<'board' | 'tools', { className: string; icon: React.ReactNode }> = {
    board: {
      className:
        'px-4 py-2 rounded-full text-sm inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-emerald-100 text-emerald-900 hover:bg-emerald-200',
      icon: <Monitor className="ml-2 h-4 w-4" />,
    },
    tools: {
      className:
        'px-4 py-2 rounded-full text-sm inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-100 text-indigo-900 hover:bg-indigo-200',
      icon: <Sparkles className="ml-2 h-4 w-4" />,
    },
  }

  const accentInfo = accent && accent !== 'none' ? accentStyles[accent] : null
  const accentClass = accentInfo?.className

  /* Ensure we don't break any styles set by richText */
  if (appearance === 'inline') {
    return (
      <Link
        className={cn(accentClass, className)}
        href={href || url || ''}
        onClick={onClick}
        {...newTabProps}
      >
        {label && label}
        {accentInfo?.icon}
        {children && children}
      </Link>
    )
  }

  return (
    <Button asChild className={className} size={size} variant={appearance}>
      <Link
        className={cn(accentClass, className)}
        href={href || url || ''}
        onClick={onClick}
        {...newTabProps}
      >
        {label && label}
        {accentInfo?.icon}
        {children && children}
      </Link>
    </Button>
  )
}
