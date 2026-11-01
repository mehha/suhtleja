// @vitest-environment node

// The member's voice and speech rate (profile page): which values the site accepts, the SSML they
// make, and the cache hash, which for the normal rate stays what it was before rates.

import { createHash } from 'crypto'
import { describe, expect, it } from 'vitest'

import { DEFAULT_TTS_VOICE, buildSSML, getTTSCacheHash, speechRate, speechVoice } from '@/utilities/azureTTS'
import { LABEL_CASE_CLASS, labelCase } from '@/utilities/labelCase'

describe('speech settings', () => {
  it('accepts only the listed voices and the default', () => {
    expect(speechVoice('et-EE-KertNeural')).toBe('et-EE-KertNeural')
    expect(speechVoice('et-EE-AnuNeural')).toBe('et-EE-AnuNeural')
    expect(speechVoice(DEFAULT_TTS_VOICE)).toBe(DEFAULT_TTS_VOICE)
    expect(speechVoice('en-US-Evil"><x')).toBe(DEFAULT_TTS_VOICE)
    expect(speechVoice(undefined)).toBe(DEFAULT_TTS_VOICE)
  })

  it('accepts only the listed rates', () => {
    expect(speechRate('slow')).toBe('slow')
    expect(speechRate('fast')).toBe('fast')
    expect(speechRate('loud')).toBe('normal')
    expect(speechRate(null)).toBe('normal')
  })

  it('says a slower or faster rate with prosody, and the normal one without', () => {
    expect(buildSSML('kass.', 'et-EE-KertNeural', 'slow')).toContain('<prosody rate="-25%">kass.</prosody>')
    expect(buildSSML('kass.', 'et-EE-KertNeural', 'fast')).toContain('<prosody rate="+20%">kass.</prosody>')
    const normal = buildSSML('kass & koer.', 'et-EE-AnuNeural')
    expect(normal).not.toContain('prosody')
    expect(normal).toContain('name="et-EE-AnuNeural"')
    expect(normal).toContain('kass &amp; koer.')
  })

  it('writes the cards in capitals unless the member picked small letters or a capital start', () => {
    expect(labelCase('lower')).toBe('lower')
    expect(labelCase('sentence')).toBe('sentence')
    expect(labelCase('shouting')).toBe('upper')
    expect(labelCase(null)).toBe('upper')
    expect(LABEL_CASE_CLASS.sentence).toContain('first-letter:uppercase')
  })

  it('keeps the old hash for the normal rate, so the speech in R2 still serves', () => {
    const old = createHash('sha256').update(`${DEFAULT_TTS_VOICE}:kass.`).digest('hex')
    expect(getTTSCacheHash('kass.')).toBe(old)
    expect(getTTSCacheHash('kass.', DEFAULT_TTS_VOICE, 'normal')).toBe(old)
    expect(getTTSCacheHash('kass.', DEFAULT_TTS_VOICE, 'slow')).not.toBe(old)
    expect(getTTSCacheHash('kass.', 'et-EE-KertNeural')).not.toBe(getTTSCacheHash('kass.', 'et-EE-AnuNeural'))
  })
})
