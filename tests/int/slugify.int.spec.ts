import { describe, expect, it } from 'vitest'
import { slugify } from '@/utilities/slugify'

describe('slugify', () => {
  it('transliterates Estonian letters instead of dropping them', () => {
    expect(slugify('Kuidas see töötab')).toBe('kuidas-see-tootab')
    expect(slugify('Õun, äädikas ja üllatus')).toBe('oun-aadikas-ja-ullatus')
    expect(slugify('Šokolaad ja žürii')).toBe('sokolaad-ja-zurii')
  })

  it('keeps slugs that are already clean', () => {
    expect(slugify('demo')).toBe('demo')
    expect(slugify('kuidas-see-tootab')).toBe('kuidas-see-tootab')
  })

  it('collapses separators and trims stray dashes', () => {
    expect(slugify('  Meist -- ja   meie lugu! ')).toBe('meist-ja-meie-lugu')
  })
})
