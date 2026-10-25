import { describe, expect, it } from 'vitest'
import type { Page } from '@/payload-types'
import { getLeadingHeading, getPageTitleMode } from '@/utilities/pageTitle'

type Block = Page['layout'][number]

function richText(...children: Record<string, unknown>[]) {
  return { root: { type: 'root', children } }
}

const heading = (text: string, tag = 'h2') => ({ type: 'heading', tag, children: [{ type: 'text', text }] })
const paragraph = (text: string) => ({ type: 'paragraph', children: [{ type: 'text', text }] })

function contentBlock(...children: Record<string, unknown>[]): Block {
  return { blockType: 'content', columns: [{ size: 'full', richText: richText(...children) }] } as unknown as Block
}

function page(title: string, layout: Block[], heroType = 'none'): Pick<Page, 'hero' | 'layout' | 'title'> {
  return { title, layout, hero: { type: heroType } } as Pick<Page, 'hero' | 'layout' | 'title'>
}

describe('page title', () => {
  it('shows the title when the content does not open with it', () => {
    expect(getPageTitleMode(page('Meist', [contentBlock(heading('Missioon'), paragraph('...'))]))).toBe('render')
    expect(getPageTitleMode(page('Kontakt', [contentBlock(paragraph('Kirjuta meile'), heading('Kontakt:'))]))).toBe('render')
  })

  it('promotes an opening heading that repeats the title', () => {
    expect(getPageTitleMode(page('Privaatsuspoliitika', [contentBlock(heading('Privaatsuspoliitika'))]))).toBe('promote')
    expect(getPageTitleMode(page('Kontakt', [contentBlock(heading('Kontakt: '))]))).toBe('promote')
    expect(
      getPageTitleMode(page('Kuidas see töötab', [{ blockType: 'aac-features', title: 'Kuidas see töötab' } as Block])),
    ).toBe('promote')
  })

  it('leaves pages alone when a hero or the homepage block already has an h1', () => {
    expect(getPageTitleMode(page('Meist', [contentBlock(paragraph('...'))], 'lowImpact'))).toBe('none')
    expect(getPageTitleMode(page('Home', [{ blockType: 'suhtlejaHomepage' } as Block]))).toBe('none')
  })

  it('reads heading text across nested inline nodes', () => {
    const nested = { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Kasutus' }, { type: 'link', children: [{ type: 'text', text: 'tingimused' }] }] }
    expect(getLeadingHeading([contentBlock(nested)])).toBe('Kasutustingimused')
    expect(getLeadingHeading([])).toBeNull()
  })
})
