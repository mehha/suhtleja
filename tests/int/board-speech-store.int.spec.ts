// @vitest-environment node
// A board's speech when Azure or R2 fails: the save keeps going, and /next/tts-cache makes the
// missing audio on request. Azure, R2 and Payload are stand-ins here.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const synthesize = vi.hoisted(() => vi.fn())
const bucket = vi.hoisted(() => ({
  get: vi.fn(),
  head: vi.fn(),
  put: vi.fn(),
}))
const payload = vi.hoisted(() => ({
  auth: vi.fn(),
  findByID: vi.fn(),
  logger: { error: vi.fn() },
}))

vi.mock('@/utilities/azureTTS', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utilities/azureTTS')>()),
  synthesizeAzureSpeech: synthesize,
}))
vi.mock('@/utilities/getCloudflareContext', () => ({
  getPayloadCloudflareContext: async () => ({ env: { R2: bucket } }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => payload }))

import { GET } from '@/app/(frontend)/next/tts-cache/[boardId]/[hash]/route'
import { DEFAULT_TTS_VOICE, getTTSCacheHash } from '@/utilities/azureTTS'
import { ensureBoardTTSManifest, getTTSObjectKey } from '@/utilities/boardTTSCache'

const voice = DEFAULT_TTS_VOICE

function board(words: string[]) {
  return {
    id: 7,
    compounds: [],
    grid: { cells: words.map((title, i) => ({ id: `c${i}`, x: i, y: 0, w: 1, h: 1, title })) },
  }
}

function synthesized(text: string) {
  return {
    audio: Buffer.from(`audio:${text}`),
    contentType: 'audio/mpeg',
    extension: 'mp3',
    text,
    voice,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  bucket.head.mockResolvedValue(null)
  bucket.put.mockResolvedValue(undefined)
  synthesize.mockImplementation(async ({ text }: { text: string }) => synthesized(text))
})

describe('saving a board when its speech fails', () => {
  it('keeps every word in the manifest when Azure fails on one', async () => {
    synthesize.mockImplementation(async ({ text }: { text: string }) => {
      if (text === 'koer.') throw new Error('azure_tts_failed:429:Too many requests')
      return synthesized(text)
    })

    const manifest = await ensureBoardTTSManifest({ board: board(['kass', 'koer', 'maja']) })

    expect(manifest.entries.map((entry) => entry.text)).toEqual(['kass.', 'koer.', 'maja.'])
    const dog = manifest.entries.find((entry) => entry.text === 'koer.')
    expect(dog?.key).toBe(getTTSObjectKey(voice, getTTSCacheHash('koer.', voice), 'mp3'))
    // Only the words that synthesized were stored.
    expect(bucket.put).toHaveBeenCalledTimes(2)
  })

  it('keeps the saved entry when R2 fails', async () => {
    const hash = getTTSCacheHash('kass.', voice)
    const saved = {
      contentType: 'audio/mpeg',
      hash,
      key: getTTSObjectKey(voice, hash, 'mp3'),
      source: 'cell',
      text: 'kass.',
      url: '',
      voice,
    }
    bucket.head.mockRejectedValue(new Error('R2 unavailable'))

    const manifest = await ensureBoardTTSManifest({
      board: { ...board(['kass']), ttsCache: { entries: [saved], updatedAt: '' } },
    })

    expect(manifest.entries).toHaveLength(1)
    expect(manifest.entries[0]?.key).toBe(saved.key)
    expect(synthesize).not.toHaveBeenCalled()
  })
})

describe('serving a board word whose audio is missing', () => {
  const hash = getTTSCacheHash('kass.', voice)
  const key = getTTSObjectKey(voice, hash, 'mp3')
  const request = () =>
    GET(new Request(`http://localhost/next/tts-cache/7/${hash}`), {
      params: Promise.resolve({ boardId: '7', hash }),
    })

  beforeEach(() => {
    payload.auth.mockResolvedValue({
      user: { id: 1, membershipStatus: 'active', role: 'user', trialEndsAt: null },
    })
    payload.findByID.mockResolvedValue({
      id: 7,
      ttsCache: {
        entries: [{ contentType: 'audio/mpeg', hash, key, source: 'cell', text: 'kass.', voice }],
        updatedAt: '',
      },
    })
  })

  it('synthesizes it, stores it under the manifest key and serves it', async () => {
    bucket.get.mockResolvedValue(null)

    const response = await request()

    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('audio:kass.')
    expect(synthesize).toHaveBeenCalledWith({ text: 'kass.', speaker: voice })
    expect(bucket.put).toHaveBeenCalledWith(key, expect.anything(), expect.anything())
  })

  it('serves stored audio from R2 without synthesizing', async () => {
    bucket.get.mockResolvedValue({
      body: new Blob(['stored']).stream(),
      httpEtag: '"etag"',
      httpMetadata: { cacheControl: 'public, max-age=31536000, immutable', contentType: 'audio/mpeg' },
    })

    const response = await request()

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('stored')
    expect(synthesize).not.toHaveBeenCalled()
  })

  it('answers 502 when Azure fails too', async () => {
    bucket.get.mockResolvedValue(null)
    synthesize.mockRejectedValue(new Error('azure_tts_failed:500:'))

    const response = await request()

    expect(response.status).toBe(502)
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('reads the board with the user’s access and only its speech manifest', async () => {
    bucket.get.mockResolvedValue(null)

    await request()

    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: false, select: { ttsCache: true } }),
    )
  })
})
