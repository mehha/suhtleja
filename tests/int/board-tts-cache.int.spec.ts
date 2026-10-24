import { describe, expect, it } from 'vitest'
import {
  buildBoardTTSCacheURL,
  getBoardTTSCacheManifest,
} from '@/utilities/boardTTSCacheManifest'

const hash = 'ddd920de1616ec8fbb770cc60aea79135ae64153afe6d9993ddeae3886c20fb9'

describe('board TTS cache manifest', () => {
  it('builds same-origin cache URLs', () => {
    expect(buildBoardTTSCacheURL(1, hash)).toBe(`/next/tts-cache/1/${hash}`)
  })

  it('ignores the origin stored by the environment that generated the cache', () => {
    const manifest = getBoardTTSCacheManifest({
      id: 1,
      ttsCache: {
        entries: [
          {
            contentType: 'audio/mpeg',
            hash,
            key: `tts/ms/et-EE-AnuNeural/${hash}.mp3`,
            source: 'cell',
            text: 'ja.',
            url: `https://suhtleja.ee/next/tts-cache/1/${hash}`,
            voice: 'et-EE-AnuNeural',
          },
        ],
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })

    expect(manifest.entries).toHaveLength(1)
    expect(manifest.entries[0]?.url).toBe(`/next/tts-cache/1/${hash}`)
  })
})
