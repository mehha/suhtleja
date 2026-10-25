import { getListenLabels } from '@/blocks/SuhtlejaHomepage/defaults'
import type { Page } from '@/payload-types'
import { DEFAULT_TTS_VOICE, getTTSCacheHash, prepareTextForTTS } from '@/utilities/azureTTS'

export function buildHomepageSpeechURL(label: string, voice = DEFAULT_TTS_VOICE): string | null {
  const text = prepareTextForTTS(label)
  if (!text) return null

  return `/next/homepage-tts/${getTTSCacheHash(text, voice)}`
}

// Returns the text behind a speech hash only when a homepage block in `pages` shows that
// word, so the public route can't be used to synthesize arbitrary text.
export function findHomepageSpeechText(
  pages: Pick<Page, 'layout'>[],
  hash: string,
  voice = DEFAULT_TTS_VOICE,
): string | null {
  for (const page of pages) {
    for (const block of page.layout ?? []) {
      if (block.blockType !== 'suhtlejaHomepage') continue

      for (const label of getListenLabels(block.listen)) {
        const text = prepareTextForTTS(label)
        if (text && getTTSCacheHash(text, voice) === hash) return text
      }
    }
  }

  return null
}
