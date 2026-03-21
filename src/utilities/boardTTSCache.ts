import type { Board } from '@/payload-types'
import { getPayloadCloudflareContext } from '@/utilities/getCloudflareContext'
import {
  DEFAULT_TTS_VOICE,
  getTTSCacheHash,
  prepareTextForTTS,
  synthesizeAzureSpeech,
} from '@/utilities/azureTTS'
import {
  type BoardTTSCacheEntry,
  type BoardTTSCacheManifest,
  buildBoardTTSCacheURL,
  getBoardTTSCacheManifest,
} from '@/utilities/boardTTSCacheManifest'

type BoardLike = Pick<Board, 'compounds' | 'grid' | 'id'> & {
  ttsCache?: unknown
}

function sanitizeVoiceForKey(voice: string): string {
  return voice.replace(/[^a-zA-Z0-9._-]+/g, '-')
}

export function collectBoardTTSInputs(board: Pick<Board, 'compounds' | 'grid'>): Array<{
  source: 'cell' | 'compound'
  text: string
}> {
  const seen = new Set<string>()
  const inputs: Array<{ source: 'cell' | 'compound'; text: string }> = []

  for (const cell of board.grid?.cells ?? []) {
    const prepared = prepareTextForTTS(cell.title ?? '')
    if (!prepared || seen.has(prepared)) continue
    seen.add(prepared)
    inputs.push({ source: 'cell', text: prepared })
  }

  for (const compound of board.compounds ?? []) {
    for (const part of compound.parts ?? []) {
      const prepared = prepareTextForTTS(part.tts || part.surface || '')
      if (!prepared || seen.has(prepared)) continue
      seen.add(prepared)
      inputs.push({ source: 'compound', text: prepared })
    }
  }

  return inputs
}

export async function ensureBoardTTSManifest({
  board,
  voice = DEFAULT_TTS_VOICE,
}: {
  board: BoardLike
  voice?: string
}): Promise<BoardTTSCacheManifest> {
  const boardId = board.id
  if (!boardId) {
    return {
      entries: [],
      updatedAt: new Date().toISOString(),
    }
  }

  const cacheInputs = collectBoardTTSInputs(board)
  if (cacheInputs.length === 0) {
    return {
      entries: [],
      updatedAt: new Date().toISOString(),
    }
  }

  const cloudflare = await getPayloadCloudflareContext()
  const bucket = cloudflare.env.R2
  const existingManifest = getBoardTTSCacheManifest(board)

  const entries: BoardTTSCacheEntry[] = []

  for (const input of cacheInputs) {
    const hash = getTTSCacheHash(input.text, voice)
    let objectKey = ''
    let contentType = 'audio/mpeg'
    const existingEntry = existingManifest.entries.find((entry) => entry.hash === hash)
    const voiceKey = sanitizeVoiceForKey(voice)

    if (existingEntry?.key) {
      objectKey = existingEntry.key
      contentType = existingEntry.contentType
    } else {
      objectKey = `tts/ms/${voiceKey}/${hash}.mp3`
    }

    const existingObject = await bucket.head(objectKey)
    if (!existingObject) {
      const synthesized = await synthesizeAzureSpeech({
        text: input.text,
        speaker: voice,
      })

      objectKey = `tts/ms/${voiceKey}/${hash}.${synthesized.extension}`
      contentType = synthesized.contentType
      const audioBuffer = synthesized.audio.buffer.slice(
        synthesized.audio.byteOffset,
        synthesized.audio.byteOffset + synthesized.audio.byteLength,
      )

      await bucket.put(objectKey, audioBuffer, {
        httpMetadata: {
          contentType: synthesized.contentType,
          cacheControl: 'public, max-age=31536000, immutable',
        },
        customMetadata: {
          text: synthesized.text,
          voice: synthesized.voice,
        },
      })
    } else if (existingObject.httpMetadata?.contentType) {
      contentType = existingObject.httpMetadata.contentType
    }

    entries.push({
      contentType,
      hash,
      key: objectKey,
      source: input.source,
      text: input.text,
      url: buildBoardTTSCacheURL(boardId, hash),
      voice,
    })
  }

  return {
    entries: entries.sort((a, b) => a.text.localeCompare(b.text)),
    updatedAt: new Date().toISOString(),
  }
}
