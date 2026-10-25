import type { Page } from '@/payload-types'

// How a CMS page gets its single h1:
// - 'none': a hero or the homepage block already renders one.
// - 'promote': the content opens with a heading that repeats the page title; render that heading as h1.
// - 'render': show the page title as an h1 above the content.
export type PageTitleMode = 'none' | 'promote' | 'render'

type HeadingLikeNode = {
  type?: string
  text?: string
  children?: HeadingLikeNode[]
}

function textOf(node: HeadingLikeNode): string {
  if (typeof node.text === 'string') return node.text
  return (node.children ?? []).map(textOf).join('')
}

function normalize(text: string): string {
  return text.trim().replace(/[\s:.!?]+$/, '').toLocaleLowerCase('et')
}

// Text of the heading the page content opens with: the first node of the first content
// column, or the title of a features or steps block placed first.
export function getLeadingHeading(layout: Page['layout'] | null | undefined): string | null {
  const first = layout?.[0]
  if (!first) return null

  if (first.blockType === 'aac-features' || first.blockType === 'howItWorks') return first.title ?? null

  if (first.blockType === 'content') {
    const node = first.columns?.[0]?.richText?.root?.children?.[0] as HeadingLikeNode | undefined
    return node?.type === 'heading' ? textOf(node) : null
  }

  return null
}

export function getPageTitleMode(page: Pick<Page, 'hero' | 'layout' | 'title'>): PageTitleMode {
  if (page.hero?.type !== 'none') return 'none'
  if (page.layout?.some((block) => block.blockType === 'suhtlejaHomepage')) return 'none'

  const leading = getLeadingHeading(page.layout)
  if (leading && normalize(leading) === normalize(page.title)) return 'promote'

  return 'render'
}
