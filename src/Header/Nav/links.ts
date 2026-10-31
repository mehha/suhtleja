import { House, Settings2, type LucideIcon } from 'lucide-react'

import type { Header } from '@/payload-types'
import { resolveHref } from '@/utilities/resolveHref'

export type AppLink = {
  href: string
  label: string
  icon: LucideIcon
  isActive: (pathname: string) => boolean
}

// Where a parent works: the child's home, and the management page (parent view only; the route
// sends the child view back to /kodu). Board and game editors count as management.
export function appLinks(isParentMode: boolean): AppLink[] {
  const kodu: AppLink = {
    href: '/kodu',
    label: 'Kodu',
    icon: House,
    isActive: (pathname) =>
      pathname === '/kodu' || pathname === '/connect-dots' || /^\/boards\/[^/]+$/.test(pathname),
  }
  if (!isParentMode) return [kodu]

  return [
    kodu,
    {
      href: '/koduhaldus',
      label: 'Koduhaldus',
      icon: Settings2,
      isActive: (pathname) =>
        pathname === '/koduhaldus' ||
        pathname.startsWith('/connect-dots/manage') ||
        /^\/boards\/[^/]+\/.+/.test(pathname),
    },
  ]
}

export type InfoLink = { href: string; label: string; newTab: boolean }

// The CMS header links, for a logged-in account's menu. Links to homepage sections (`/#hind`) are
// sales pitches, which a member doesn't need.
export function infoLinks(data: Header): InfoLink[] {
  return (data?.navItems ?? []).flatMap((item) => {
    const href = resolveHref(item.link)
    const reference = item.link?.reference?.value
    const label =
      item.label || item.link?.label || (typeof reference === 'object' ? reference?.title : '')

    if (!href || !label || href.startsWith('/#')) return []
    return [{ href, label, newTab: Boolean(item.link?.newTab) }]
  })
}
