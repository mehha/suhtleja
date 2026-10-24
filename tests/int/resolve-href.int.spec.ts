import { describe, expect, it } from 'vitest'
import type { Page, Post } from '@/payload-types'
import { resolveHref } from '@/utilities/resolveHref'

const page = (slug: string) => ({ slug }) as Page
const post = (slug: string) => ({ slug }) as Post

describe('resolveHref', () => {
  it('links the home page to "/" instead of "/home"', () => {
    expect(resolveHref({ reference: { relationTo: 'pages', value: page('home') }, type: 'reference' })).toBe('/')
  })

  it('links other pages and posts by slug', () => {
    expect(resolveHref({ reference: { relationTo: 'pages', value: page('demo') }, type: 'reference' })).toBe('/demo')
    expect(resolveHref({ reference: { relationTo: 'posts', value: post('uudis') }, type: 'reference' })).toBe(
      '/posts/uudis',
    )
  })

  it('falls back to the custom URL', () => {
    expect(resolveHref({ type: 'custom', url: 'https://example.com' })).toBe('https://example.com')
    expect(resolveHref({ reference: { relationTo: 'pages', value: 3 }, type: 'reference', url: null })).toBeNull()
  })
})
