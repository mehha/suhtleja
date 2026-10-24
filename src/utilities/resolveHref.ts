// src/utilities/resolveHref.ts
import type { Page, Post } from '@/payload-types'

type LinkLike = {
  type?: 'custom' | 'reference' | null
  url?: string | null
  reference?: {
    relationTo: 'pages' | 'posts'
    value: Page | Post | string | number
  } | null
}

export function resolveHref(link?: LinkLike): string | null {
  if (!link) return null

  const value = link.type === 'reference' ? link.reference?.value : undefined
  if (link.reference && typeof value === 'object' && value.slug) {
    const { relationTo } = link.reference
    // The home page is served at "/"; "/home" redirects logged-out visitors to the login page.
    if (relationTo === 'pages' && value.slug === 'home') return '/'
    const base = relationTo !== 'pages' ? `/${relationTo}` : ''
    return `${base}/${value.slug}`
  }
  return link.url ?? null
}

// strict-ish match: exact or as a parent (e.g. /blog matches /blog/article)
export function isPathActive(pathname: string, href: string | null): boolean {
  if (!href) return false
  if (href !== '/' && pathname === '/') return false
  if (pathname === href) return true
  return pathname.startsWith(href.endsWith('/') ? href : `${href}/`)
}
