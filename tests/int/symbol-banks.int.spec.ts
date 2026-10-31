// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getSymbolSearchTerms } from '@/utilities/groq'
import { searchSymbolBanks } from '@/utilities/symbolSources'

vi.mock('@/utilities/groq', () => ({
  getSymbolSearchTerms: vi.fn(),
}))

const termsMock = vi.mocked(getSymbolSearchTerms)

// ARASAAC knows "koer" in Estonian and "dog" in English; Mulberry (English labels) knows "dog" and
// "puppy". Every other query finds nothing.
const ARASAAC: Record<string, Array<{ _id: number; keywords: Array<{ keyword: string }> }>> = {
  'et/koer': [{ _id: 1, keywords: [{ keyword: 'koer' }] }],
  'en/dog': [{ _id: 2, keywords: [{ keyword: 'dog' }] }],
}
const mulberry = (id: number, text: string) => ({
  text,
  picto: { id, image_url: `https://globalsymbols.com/uploads/production/image/${id}.svg` },
})
const MULBERRY: Record<string, Array<ReturnType<typeof mulberry>>> = {
  dog: [mulberry(10, 'Dog')],
  puppy: [mulberry(11, 'puppy')],
  break: [mulberry(20, 'Break Dance'), mulberry(21, 'Breakfast'), mulberry(22, 'Break')],
  recess: [mulberry(23, 'Recess')],
}

function fakeFetch(input: string | URL | Request) {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  let body: unknown = []
  if (url.hostname === 'api.arasaac.org') {
    const [, , , locale, , q] = url.pathname.split('/')
    body = ARASAAC[`${locale}/${decodeURIComponent(q)}`] ?? []
  } else if (url.hostname === 'globalsymbols.com') {
    body = MULBERRY[url.searchParams.get('query') ?? ''] ?? []
  }
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

const ids = (items: Array<{ id: string }>) => items.map((item) => item.id)

describe('searchSymbolBanks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(fakeFetch))
    termsMock.mockReset()
    termsMock.mockResolvedValue({ terms: ['dog', 'puppy'] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('finds Mulberry pictures for an Estonian word through the English terms', async () => {
    const { results } = await searchSymbolBanks(['arasaac', 'mulberry'], 'koer', { limit: 24 })

    expect(termsMock).toHaveBeenCalledTimes(1)
    expect(results.map((result) => result.bank)).toEqual(['arasaac', 'mulberry'])
    // ARASAAC found the word itself, so it keeps that result.
    expect(results[0].aiTerms).toBeUndefined()
    expect(results[1].aiTerms).toEqual(['dog', 'puppy'])
    expect(ids(results[0].items)).toEqual(['arasaac-1'])
    expect(ids(results[1].items)).toEqual(['mulberry-10', 'mulberry-11'])
  })

  it('does not ask Groq when every bank finds the word itself', async () => {
    const { results } = await searchSymbolBanks(['arasaac', 'mulberry'], 'dog', { limit: 24 })

    expect(termsMock).not.toHaveBeenCalled()
    expect(ids(results[0].items)).toEqual(['arasaac-2'])
    expect(ids(results[1].items)).toEqual(['mulberry-10'])
  })

  it('asks Groq once and gives its terms to every bank that found nothing', async () => {
    const { results } = await searchSymbolBanks(['arasaac', 'mulberry'], 'kutsikas', { limit: 24 })

    expect(termsMock).toHaveBeenCalledTimes(1)
    expect(results.map((result) => result.aiTerms)).toEqual([['dog', 'puppy'], ['dog', 'puppy']])
    expect(ids(results[0].items)).toEqual(['arasaac-2'])
  })

  it('leaves ARASAAC empty when the member already has pictures for the word', async () => {
    const found = await searchSymbolBanks(['arasaac'], 'kutsikas', {
      limit: 24,
      othersFound: Promise.resolve(true),
    })
    expect(termsMock).not.toHaveBeenCalled()
    expect(found.results).toEqual([{ bank: 'arasaac', items: [] }])

    const notFound = await searchSymbolBanks(['arasaac'], 'kutsikas', {
      limit: 24,
      othersFound: Promise.resolve(false),
    })
    expect(termsMock).toHaveBeenCalledTimes(1)
    expect(ids(notFound.results[0].items)).toEqual(['arasaac-2'])
  })

  it('still tries the English terms for Mulberry when the member has pictures', async () => {
    const { results } = await searchSymbolBanks(['mulberry'], 'koer', { limit: 24, othersFound: true })

    expect(termsMock).toHaveBeenCalledTimes(1)
    expect(ids(results[0].items)).toEqual(['mulberry-10', 'mulberry-11'])
  })

  it('keeps the direct results and reports the error when Groq fails', async () => {
    termsMock.mockResolvedValue({ error: 'groq_failed', terms: [] })

    const { aiError, results } = await searchSymbolBanks(['arasaac', 'mulberry'], 'koer', { limit: 24 })

    expect(aiError).toBe('groq_failed')
    expect(ids(results[0].items)).toEqual(['arasaac-1'])
    expect(results[1]).toEqual({ bank: 'mulberry', items: [] })
  })

  it('puts the exact match of every term before the near misses', async () => {
    termsMock.mockResolvedValue({ terms: ['break', 'recess'] })

    const { results } = await searchSymbolBanks(['mulberry'], 'vahetund', { limit: 24 })

    expect(ids(results[0].items)).toEqual([
      'mulberry-22',
      'mulberry-23',
      'mulberry-20',
      'mulberry-21',
    ])
  })
})
