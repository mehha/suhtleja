// @vitest-environment node

// The card editor's picture search order (src/utilities/pictureMatch.ts), with the picture bank's
// own names: until 2026-11-03 "ei" showed "leidma" and "leib" and no "ei", "uni" showed "kuningas".

import { describe, expect, it } from 'vitest'

import { pictureMatchRank, rankPictureMatches } from '@/utilities/pictureMatch'

describe('pictureMatchRank', () => {
  it('ranks the exact name first, ignoring case and Unicode form', () => {
    expect(pictureMatchRank('õun', 'õun')).toBe(0)
    expect(pictureMatchRank('Õun', 'õun')).toBe(0)
    expect(pictureMatchRank('õun', 'õun')).toBe(0)
  })

  it('then a name that starts with the query, then a later word that does', () => {
    expect(pictureMatchRank('palli lööma', 'pall')).toBe(1)
    expect(pictureMatchRank('kassipoeg', 'kass')).toBe(1)
    expect(pictureMatchRank('ma ei taha', 'ei')).toBe(2)
    expect(pictureMatchRank('ära tee', 'tee')).toBe(2)
    expect(pictureMatchRank('kooli-minema', 'minema')).toBe(2)
  })

  it("then a compound's last part, for a query of 4 letters or more", () => {
    expect(pictureMatchRank('õhupall', 'pall')).toBe(3)
    expect(pictureMatchRank('veoauto', 'auto')).toBe(3)
    expect(pictureMatchRank('hommikusöök', 'söök')).toBe(3)
  })

  it('drops a match inside a word, and word endings of short queries', () => {
    expect(pictureMatchRank('lõunauni', 'õun')).toBeNull()
    expect(pictureMatchRank('leib', 'ei')).toBeNull()
    expect(pictureMatchRank('kuningas', 'uni')).toBeNull()
    expect(pictureMatchRank('lihapallid', 'pall')).toBeNull()
    expect(pictureMatchRank('veerema', 'ema')).toBeNull()
    expect(pictureMatchRank('apteek', 'tee')).toBeNull()
  })

  it('takes the best of several places in the name', () => {
    expect(pictureMatchRank('lõunasöök ja söök', 'söök')).toBe(2)
  })
})

describe('rankPictureMatches', () => {
  const names = (item: { alt: string; file?: string }) => [item.alt, item.file ?? '']

  it('puts the exact picture first even when newer ones contain the word', () => {
    const found = [
      { alt: 'leidma' },
      { alt: 'ma ei taha' },
      { alt: 'leib' },
      { alt: 'peitust mängima' },
      { alt: 'eile' },
      { alt: 'ei' },
    ]
    expect(rankPictureMatches(found, 'ei', names).map((item) => item.alt)).toEqual(['ei', 'eile', 'ma ei taha'])
  })

  it('orders a rank by the shorter name, then keeps the given order', () => {
    const found = [{ alt: 'kuumaõhupall' }, { alt: 'palli lööma' }, { alt: 'õhupall' }, { alt: 'pall' }, { alt: 'pallid' }]
    expect(rankPictureMatches(found, 'pall', names).map((item) => item.alt)).toEqual([
      'pall',
      'pallid',
      'palli lööma',
      'õhupall',
      'kuumaõhupall',
    ])
  })

  it('matches the file name when the alt text does not', () => {
    const found = [{ alt: 'Muri', file: 'koer-muri' }, { alt: 'kass' }]
    expect(rankPictureMatches(found, 'koer', names)).toEqual([{ alt: 'Muri', file: 'koer-muri' }])
  })
})
