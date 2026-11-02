// @vitest-environment node

// Azure speech is tried again when Azure is rate limited or busy (429, 503), and not on other errors
// (src/utilities/azureTTS.ts, docs/rules/project/audio-tts.md). Azure is a stand-in: fetch is mocked.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const audio = () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
const limited = (headers: Record<string, string> = {}) => new Response('Quota Exceeded', { status: 429, headers })

async function loadSynthesize() {
  vi.stubEnv('SPEECH_KEY', 'test-key')
  vi.stubEnv('SPEECH_REGION', 'northeurope')
  vi.resetModules()
  return (await import('@/utilities/azureTTS')).synthesizeAzureSpeech
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Azure speech when Azure is rate limited', () => {
  it('tries again after a 429 and speaks', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(limited()).mockResolvedValueOnce(audio())
    vi.stubGlobal('fetch', fetchMock)
    const synthesize = await loadSynthesize()

    const spoken = synthesize({ text: 'tere' })
    await vi.advanceTimersByTimeAsync(2000)
    const result = await spoken

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.text).toBe('tere.')
    expect([...result.audio]).toEqual([1, 2, 3])
  })

  it('waits as long as Azure asks, but not longer than 1.5 s', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(limited({ 'retry-after': '1' })).mockResolvedValueOnce(audio())
    vi.stubGlobal('fetch', fetchMock)
    const synthesize = await loadSynthesize()

    const spoken = synthesize({ text: 'tere' })
    await vi.advanceTimersByTimeAsync(900)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await spoken

    // Azure asking for a minute still waits 1.5 s.
    const longWait = vi.fn().mockResolvedValueOnce(limited({ 'retry-after': '60' })).mockResolvedValueOnce(audio())
    vi.stubGlobal('fetch', longWait)
    const again = (await loadSynthesize())({ text: 'tere' })
    await vi.advanceTimersByTimeAsync(1500)
    expect(longWait).toHaveBeenCalledTimes(2)
    await again
  })

  it('gives up after two more tries', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => limited())
    vi.stubGlobal('fetch', fetchMock)
    const synthesize = await loadSynthesize()

    const spoken = synthesize({ text: 'tere' })
    const failed = expect(spoken).rejects.toThrow('azure_tts_failed:429')
    await vi.advanceTimersByTimeAsync(5000)
    await failed
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("doesn't try again on other errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Bad request', { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const synthesize = await loadSynthesize()

    await expect(synthesize({ text: 'tere' })).rejects.toThrow('azure_tts_failed:400')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
