import { describe, expect, it } from 'vitest'
import { getListenLabels, homepageDefaults, rowsOr, textOr } from '@/blocks/SuhtlejaHomepage/defaults'
import type { Page } from '@/payload-types'
import { getTTSCacheHash } from '@/utilities/azureTTS'
import { buildHomepageSpeechURL, findHomepageSpeechText } from '@/utilities/homepageSpeech'

const voice = 'et-EE-AnuNeural'

function homepage(listen: Record<string, unknown>): Pick<Page, 'layout'> {
  return {
    layout: [{ blockType: 'suhtlejaHomepage', listen } as unknown as Page['layout'][number]],
  }
}

describe('homepage fallbacks', () => {
  it('uses the fallback for empty text and empty lists', () => {
    expect(textOr('  ', 'vaikimisi')).toBe('vaikimisi')
    expect(textOr(null, 'vaikimisi')).toBe('vaikimisi')
    expect(textOr('oma tekst', 'vaikimisi')).toBe('oma tekst')
    expect(rowsOr([], ['a'])).toEqual(['a'])
    expect(rowsOr(null, ['a'])).toEqual(['a'])
    expect(rowsOr(['b'], ['a'])).toEqual(['b'])
  })

  it('speaks the default words until an editor adds tiles', () => {
    expect(getListenLabels(undefined)).toEqual(homepageDefaults.listen.tiles)
    expect(getListenLabels({ tiles: [{ label: ' ' }] })).toEqual(homepageDefaults.listen.tiles)
    expect(getListenLabels({ tiles: [{ label: ' piim ' }] })).toEqual(['piim'])
    expect(getListenLabels({ enabled: false, tiles: [{ label: 'piim' }] })).toEqual([])
  })
})

describe('homepage speech', () => {
  it('builds same-origin URLs from the normalized word and voice', () => {
    expect(buildHomepageSpeechURL('juua', voice)).toBe(
      `/next/homepage-tts/${getTTSCacheHash('juua.', voice)}`,
    )
    expect(buildHomepageSpeechURL('  ', voice)).toBeNull()
  })

  it('only resolves words that a homepage block shows', () => {
    const pages = [homepage({ tiles: [{ label: 'piim' }] })]

    expect(findHomepageSpeechText(pages, getTTSCacheHash('piim.', voice), voice)).toBe('piim.')
    expect(findHomepageSpeechText(pages, getTTSCacheHash('juua.', voice), voice)).toBeNull()
    expect(findHomepageSpeechText(pages, getTTSCacheHash('suvaline tekst.', voice), voice)).toBeNull()
  })

  it('resolves the default words when the block has no tiles', () => {
    const pages = [homepage({})]

    expect(findHomepageSpeechText(pages, getTTSCacheHash('juua.', voice), voice)).toBe('juua.')
  })

  it('speaks nothing when the section is switched off', () => {
    const pages = [homepage({ enabled: false })]

    expect(findHomepageSpeechText(pages, getTTSCacheHash('juua.', voice), voice)).toBeNull()
  })
})
