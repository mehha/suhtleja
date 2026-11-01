// @vitest-environment node

// The picture bank: the import's pure parts (scripts/pildipank/lib.ts) and the folder listing the card
// editor browses (src/utilities/findLibraryMedia.ts). The Payload tests use their own root folder, so
// they never touch an imported "Pildipank".

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { listPictureBankCategories, listPictureBankPictures } from '@/utilities/findLibraryMedia'
import {
  aiPictureKey,
  buildBankItems,
  describesGroup,
  parseCsv,
  toCsv,
  renderShape,
  renderTextTile,
  sanitizeSvg,
  slug,
  type CsvRow,
} from '../../scripts/pildipank/lib'

const emojiRow = (emoji: string, word: string, category: string, code: string, kaasa = 'jah'): CsvRow => ({
  emoji,
  fluent_pilt: `assets/${word}/3D/${word}_3d.png`,
  kaasa,
  kategooria: category,
  kood: code,
  sõna: word,
})
const wordRow = (word: string, category: string, pilt: string, viide = ''): CsvRow => ({
  kaasa: 'jah',
  kategooria: category,
  pilt,
  sõna: word,
  viide,
})

describe('picture bank lists', () => {
  it('reads quoted CSV fields with commas, quotes and line breaks', () => {
    const rows = parseCsv('sõna,märkus\nkoer,"lemmikloom, sõber"\n"ütle ""tere""","kaks\nrida"\n')
    expect(rows).toEqual([
      { märkus: 'lemmikloom, sõber', sõna: 'koer' },
      { märkus: 'kaks\nrida', sõna: 'ütle "tere"' },
    ])
  })

  it('turns words into ASCII file names', () => {
    expect(slug('Jõulukuusk')).toBe('joulukuusk')
    expect(slug('head ööd')).toBe('head-ood')
  })

  it('files a vocabulary word that is also an emoji word under the vocabulary category', () => {
    const { items, waitingForAI } = buildBankItems(
      [
        emojiRow('👍', 'hea', 'Suhtlemine', '1f44d'),
        emojiRow('🐈', 'kass', 'Loomad', '1f408'),
        emojiRow('🧈', 'või', 'Toit', '1f9c8'),
        emojiRow('🦮', 'juhtkoer', 'Loomad', '1f9ae', 'ei'),
      ],
      [
        wordRow('hea', 'Omadussõnad', 'emoji', '👍'),
        wordRow('kiisu', 'Loomad', 'emoji', '🐈'),
        wordRow('või', 'Põhisõnad', 'tekst', 'või'),
        wordRow('tahtma', 'Tegevused', 'mulberry', 'https://globalsymbols.com/uploads/production/image/x.svg'),
        wordRow('mul', 'Asesõnad', 'AI'),
      ],
    )

    const byKey = Object.fromEntries(items.map((item) => [item.key, item]))
    // One picture for "hea", now among the adjectives.
    expect(items.filter((item) => item.word === 'hea')).toHaveLength(1)
    expect(byKey['pildipank-hea-1f44d'].category).toBe('Omadussõnad')
    // Another word for the same emoji is its own picture.
    expect(byKey['pildipank-kiisu-1f408']).toMatchObject({ category: 'Loomad', word: 'kiisu' })
    // Homonyms: the butter and the conjunction both stay.
    expect(items.filter((item) => item.word === 'või').map((item) => item.source.kind).sort()).toEqual(['fluent', 'tekst'])
    // Dropped emoji stay out; AI words wait.
    expect(items.some((item) => item.word === 'juhtkoer')).toBe(false)
    expect(waitingForAI).toEqual(['mul'])
    // Category order (Põhisõnad, Omadussõnad, Tegevused, Toit, Loomad), each category's cover first
    // ("koer" is not here, so "kass" leads Loomad).
    expect(items.map((item) => `${item.word}:${item.category}`)).toEqual([
      'või:Põhisõnad',
      'hea:Omadussõnad',
      'tahtma:Tegevused',
      'või:Toit',
      'kass:Loomad',
      'kiisu:Loomad',
    ])
  })

  it('keeps file names apart when transliteration would merge words', () => {
    const { items } = buildBankItems(
      [emojiRow('🧺', 'korv', 'Kodu', '1f9fa'), emojiRow('👂', 'kõrv', 'Keha', '1f442')],
      [wordRow('S', 'Tähed', 'tekst', 'S'), wordRow('Š', 'Tähed', 'tekst', 'Š')],
    )
    expect(new Set(items.map((item) => item.key)).size).toBe(4)
  })

  it('imports an AI word once generate-ai.ts has made its picture', () => {
    const { items, waitingForAI } = buildBankItems(
      [],
      [wordRow('meie', 'Asesõnad', 'AI', 'pildipank-meie-ai.jpg'), wordRow('mul', 'Asesõnad', 'AI')],
    )
    expect(items).toEqual([
      expect.objectContaining({ key: aiPictureKey('meie'), source: { file: 'pildipank-meie-ai.jpg', kind: 'ai' }, word: 'meie' }),
    ])
    expect(waitingForAI).toEqual(['mul'])
  })

  it('writes the reviewed list back unchanged', () => {
    const text = 'kaasa,sõna,märkus\njah,koer,"lemmikloom, sõber"\njah,"ütle ""tere""",\n'
    expect(toCsv(parseCsv(text), ['kaasa', 'sõna', 'märkus'])).toBe(text)
  })

  it('spots descriptions of several people', () => {
    expect(describesGroup('three children standing next to a pile of toys')).toBe(true)
    expect(describesGroup('a family of a mother, a father and two children')).toBe(true)
    expect(describesGroup('a child drinking from a cup')).toBe(false)
  })

  it('rejects an unknown category', () => {
    expect(() => buildBankItems([], [wordRow('x', 'Tundmatu', 'tekst', 'x')])).toThrow(/unknown category/)
  })
})

describe('picture bank tiles', () => {
  it('escapes text tiles', () => {
    const tile = renderTextTile('<a & "b">')
    expect(tile).toContain('&lt;a &amp; &quot;b&quot;&gt;')
    expect(tile).not.toContain('<a ')
  })

  it('draws every shape the vocabulary uses and highlights weekdays', () => {
    for (const spec of ['ring', 'ruut', 'kolmnurk', 'ristkülik', 'ovaal', 'romb', 'värv:#f472b6', 'nädal', 'lipp:ee']) {
      expect(renderShape(spec)).toMatch(/^<svg /)
    }
    const highlighted = (spec: string) => renderShape(spec).match(/#2563eb/g)?.length ?? 0
    expect(highlighted('nädal:3')).toBe(1)
    expect(highlighted('nädal:6-7')).toBe(2)
    expect(highlighted('nädal')).toBe(0)
    expect(() => renderShape('hexagon')).toThrow()
  })
})

describe('third-party SVG', () => {
  it('keeps a plain symbol as it is', () => {
    const plain = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z" fill="#5668af"/></svg>'
    expect(sanitizeSvg(plain)).toBe(plain)
  })

  it('removes scripts, handlers, embedded documents and outside links', () => {
    const clean = sanitizeSvg(
      '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">' +
        '<script>alert(2)</script><foreignObject><body/></foreignObject>' +
        '<a href="javascript:alert(3)"><use xlink:href="https://evil.example/x.svg#a"/></a>' +
        '<use href="#local"/><rect style="fill:url(https://evil.example/p)" fill="url(#grad)"/></svg>',
    )
    expect(clean).not.toBeNull()
    expect(clean).not.toMatch(/onload|<script|foreignObject|javascript:|evil\.example|ENTITY/i)
    expect(clean).toContain('href="#local"')
    expect(clean).toContain('url(#grad)')
  })

  it('refuses something that is not an SVG', () => {
    expect(sanitizeSvg('<html><body>hi</body></html>')).toBeNull()
  })
})

describe('picture bank folders', () => {
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const rootName = `Pildipank-test-${run}`
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  )
  let payload: Payload
  const created: Array<{ collection: 'media' | 'payload-folders'; id: number }> = []
  const ids: Record<string, number> = {}

  const folder = async (name: string, parent?: number) => {
    const doc = await payload.create({
      collection: 'payload-folders',
      data: { folder: parent, folderType: ['media'], name },
      overrideAccess: true,
    })
    created.push({ collection: 'payload-folders', id: doc.id })
    return doc.id
  }
  const picture = async (name: string, folderId: number) => {
    const doc = await payload.create({
      collection: 'media',
      data: { alt: name, folder: folderId } as never,
      file: { data: tinyPng, mimetype: 'image/png', name: `bank-${name}-${run}.png`, size: tinyPng.length },
      overrideAccess: true,
    })
    created.push({ collection: 'media', id: doc.id })
    return doc
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    ids.root = await folder(rootName)
    ids.animals = await folder('Loomad', ids.root)
    ids.food = await folder('Toit', ids.root)
    ids.empty = await folder('Tühi', ids.root)
    ids.outside = await folder(`Muu-${run}`)
    await picture('koer', ids.animals)
    await picture('kass', ids.animals)
    await picture('leib', ids.food)
    await picture('võõras', ids.outside)
  })

  afterAll(async () => {
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => {})
    }
  })

  it('lists the categories that hold pictures, in creation order, with the oldest picture as cover', async () => {
    const categories = await listPictureBankCategories(payload, rootName)
    expect(categories.map(({ count, name }) => ({ count, name }))).toEqual([
      { count: 2, name: 'Loomad' },
      { count: 1, name: 'Toit' },
    ])
    expect(categories[0].cover).toContain(`bank-koer-${run}`)
  })

  it("lists a category's pictures oldest first, and nothing outside the bank", async () => {
    const animals = await listPictureBankPictures(payload, ids.animals, { rootName })
    expect(animals?.name).toBe('Loomad')
    expect(animals?.pictures.map((item) => item.title)).toEqual(['koer', 'kass'])

    expect(await listPictureBankPictures(payload, ids.outside, { rootName })).toBeNull()
    expect(await listPictureBankPictures(payload, ids.root, { rootName })).toBeNull()
    expect(await listPictureBankPictures(payload, 999999999, { rootName })).toBeNull()
  })
})
