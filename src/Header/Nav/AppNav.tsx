'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/utilities/ui'

import type { AppLink } from './links'

// The logged-in header's main links, labelled, with the current page marked.
export function AppNav({ links }: { links: AppLink[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Peamenüü" className="flex items-center gap-1">
      {links.map(({ href, label, icon: Icon, isActive }) => {
        const active = isActive(pathname)

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:h-[18px] [&_svg]:w-[18px]',
              active
                ? 'bg-slate-100 text-slate-950'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
            )}
          >
            <Icon aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
