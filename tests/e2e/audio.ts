import type { Page } from '@playwright/test'

// Counts the sounds the page starts playing, so a test knows a board really spoke. The board's
// silent unlock sound (a data: URL) doesn't count.
export async function countPlayedAudio(page: Page) {
  await page.addInitScript(() => {
    const played: string[] = []
    Object.assign(window, { __playedAudio: played })
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      const src = this.src
      const started = play.call(this)
      if (!src.startsWith('data:')) void started.then(() => played.push(src), () => undefined)
      return started
    }
  })
  return () => page.evaluate(() => (window as unknown as { __playedAudio: string[] }).__playedAudio.length)
}

// A short silent WAV: speech that plays and ends in every browser, without the speech service.
export function silentWav(seconds = 0.2) {
  const sampleRate = 8000
  const samples = Math.round(sampleRate * seconds)
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  return buffer
}
