import { createHash } from 'crypto'

import { SPEECH_RATES, TTS_VOICES, type SpeechRate } from './speechSettings'

export { SPEECH_RATES, TTS_VOICES, speechRate, type SpeechRate } from './speechSettings'

const SPEECH_KEY = process.env.SPEECH_KEY
const SPEECH_REGION = process.env.SPEECH_REGION

export const DEFAULT_TTS_VOICE =
  process.env.SPEECH_VOICE ?? 'en-US-Ava:DragonHDLatestNeural'
export const TTS_OUTPUT_FORMAT =
  process.env.SPEECH_OUTPUT_FORMAT ?? 'audio-24khz-48kbitrate-mono-mp3'

/** A voice the site speaks with: one of TTS_VOICES or the default; anything else is the default. */
export function speechVoice(value: unknown): string {
  return typeof value === 'string' && (value in TTS_VOICES || value === DEFAULT_TTS_VOICE) ? value : DEFAULT_TTS_VOICE
}

export function prepareTextForTTS(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  if (/[.!?]$/.test(trimmed)) return trimmed
  return `${trimmed}.`
}

function escapeForSSML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function getTTSAudioMetadata(outputFormat = TTS_OUTPUT_FORMAT): {
  contentType: string
  extension: string
} {
  if (outputFormat.includes('mp3') || outputFormat.includes('mpeg')) {
    return {
      contentType: 'audio/mpeg',
      extension: 'mp3',
    }
  }

  return {
    contentType: 'audio/wav',
    extension: 'wav',
  }
}

// The normal rate keeps the hash it had before rates, so the speech already in R2 still serves.
export function getTTSCacheHash(text: string, voice = DEFAULT_TTS_VOICE, rate: SpeechRate = 'normal'): string {
  return createHash('sha256')
    .update(rate === 'normal' ? `${voice}:${text}` : `${voice}:${rate}:${text}`)
    .digest('hex')
}

/** The SSML for a text in a voice and at a rate. The voice is one of ours (speechVoice). */
export function buildSSML(text: string, speaker: string, rate: SpeechRate = 'normal'): string {
  const prosody = SPEECH_RATES[rate].prosody
  const words = escapeForSSML(text)
  return `
<speak version="1.0" xml:lang="et-EE">
  <voice xml:lang="et-EE" name="${escapeForSSML(speaker)}">
    ${prosody ? `<prosody rate="${prosody}">${words}</prosody>` : words}
  </voice>
</speak>
`.trim()
}

export async function synthesizeAzureSpeech({
  text,
  speaker = DEFAULT_TTS_VOICE,
  rate = 'normal',
}: {
  text: string
  speaker?: string
  rate?: SpeechRate
}): Promise<{
  audio: Buffer
  contentType: string
  extension: string
  text: string
  voice: string
}> {
  if (!SPEECH_KEY || !SPEECH_REGION) {
    throw new Error('missing_azure_tts_config')
  }

  const normalizedText = prepareTextForTTS(text)
  if (!normalizedText) {
    throw new Error('missing_tts_text')
  }

  const ssml = buildSSML(normalizedText, speaker, rate)

  const ttsRes = await fetch(
    `https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        // The key goes straight to the synthesis: exchanging it for a token first cost a second
        // round trip to Azure (0.1-0.5s) on every request.
        'Ocp-Apim-Subscription-Key': SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': TTS_OUTPUT_FORMAT,
        'User-Agent': 'suhtleja-aac-nextjs',
      },
      body: ssml,
    },
  )

  if (!ttsRes.ok) {
    const detail = await ttsRes.text().catch(() => '')
    throw new Error(`azure_tts_failed:${ttsRes.status}:${detail || ttsRes.statusText}`)
  }

  const audioBuffer = Buffer.from(await ttsRes.arrayBuffer())
  const { contentType, extension } = getTTSAudioMetadata()

  return {
    audio: audioBuffer,
    contentType,
    extension,
    text: normalizedText,
    voice: speaker,
  }
}
