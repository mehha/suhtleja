// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  base64ImageToDataURL,
  buildPictogramPrompt,
  startOfMonthUTC,
} from '@/utilities/symbolGeneration'
import { getSymbolProxyURL, isProxyableSymbolURL, isSvgImageURL } from '@/utilities/symbolProxy'

describe('symbol proxy allowlist', () => {
  it('accepts Mulberry images from Global Symbols uploads', () => {
    const src =
      'https://globalsymbols.com/uploads/production/image/imagefile/49188/13_49189_34b5b05e.png'
    expect(isProxyableSymbolURL(src)).toBe(true)
    expect(getSymbolProxyURL(src)).toBe(`/next/symbol-image?src=${encodeURIComponent(src)}`)
  })

  it('rejects other Global Symbols paths, plain http and path tricks', () => {
    expect(isProxyableSymbolURL('https://globalsymbols.com/api/v1/labels/search?query=dog')).toBe(false)
    expect(isProxyableSymbolURL('http://globalsymbols.com/uploads/production/image/a.png')).toBe(false)
    expect(isProxyableSymbolURL('https://globalsymbols.com/uploads/production/image/../../api/v1/x')).toBe(false)
    expect(isProxyableSymbolURL('https://globalsymbols.com.evil.example/uploads/production/image/a.png')).toBe(false)
  })

  it('keeps the existing sources', () => {
    expect(isProxyableSymbolURL('https://static.arasaac.org/pictograms/2517/2517_500.png')).toBe(true)
    expect(isProxyableSymbolURL('https://unpkg.com/openmoji@15.0.0/color/svg/1F415.svg')).toBe(true)
  })
})

describe('SVG symbols skip the image optimizer', () => {
  it('spots SVG URLs, including ones with a query string', () => {
    expect(isSvgImageURL('https://unpkg.com/openmoji@15.0.0/color/svg/1F415.svg')).toBe(true)
    expect(isSvgImageURL('https://globalsymbols.com/uploads/production/image/imagefile/4042/13_4042_a.SVG?x=1')).toBe(true)
    expect(isSvgImageURL('https://static.arasaac.org/pictograms/2517/2517_500.png?download=false')).toBe(false)
    expect(isSvgImageURL('/next/dev-media/koer.png')).toBe(false)
    expect(isSvgImageURL(null)).toBe(false)
  })
})

describe('AI pictogram generation', () => {
  it('counts the month from its first day in UTC', () => {
    expect(startOfMonthUTC(new Date('2026-10-31T23:30:00+02:00')).toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(startOfMonthUTC(new Date('2026-11-01T00:30:00+02:00')).toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('wraps the subject in one pictogram style without text', () => {
    const prompt = buildPictogramPrompt('  a brown dog ')
    expect(prompt.startsWith('Pictogram for an AAC communication board: a brown dog.')).toBe(true)
    expect(prompt).toContain('No text')
  })

  it('labels the base64 image with its type', () => {
    expect(base64ImageToDataURL('/9j/4AAQ')).toBe('data:image/jpeg;base64,/9j/4AAQ')
    expect(base64ImageToDataURL('iVBORw0K')).toBe('data:image/png;base64,iVBORw0K')
  })
})
