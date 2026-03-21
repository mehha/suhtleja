import { createHash } from 'crypto'

const SPEECH_KEY = process.env.SPEECH_KEY
const SPEECH_REGION = process.env.SPEECH_REGION

export const DEFAULT_TTS_VOICE =
  process.env.SPEECH_VOICE ?? 'en-US-Ava:DragonHDLatestNeural'
export const TTS_OUTPUT_FORMAT =
  process.env.SPEECH_OUTPUT_FORMAT ?? 'audio-24khz-48kbitrate-mono-mp3'

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

export function getTTSCacheHash(text: string, voice = DEFAULT_TTS_VOICE): string {
  return createHash('sha256')
    .update(`${voice}:${text}`)
    .digest('hex')
}

export async function synthesizeAzureSpeech({
  text,
  speaker = DEFAULT_TTS_VOICE,
}: {
  text: string
  speaker?: string
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

  const tokenRes = await fetch(
    `https://${SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': SPEECH_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  )

  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => '')
    throw new Error(`azure_tts_token_failed:${tokenRes.status}:${detail || tokenRes.statusText}`)
  }

  const accessToken = await tokenRes.text()
  const ssml = `
<speak version="1.0" xml:lang="et-EE">
  <voice xml:lang="et-EE" name="${speaker}">
    ${escapeForSSML(normalizedText)}
  </voice>
</speak>
`.trim()

  const ttsRes = await fetch(
    `https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
