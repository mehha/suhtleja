import type { Board } from '@/payload-types'
import { getPayloadCloudflareContext } from '@/utilities/getCloudflareContext'
import {
  DEFAULT_TTS_VOICE,
  getTTSAudioMetadata,
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
import { boardVerbForms } from '@/utilities/grammar/applyGrammar'

type BoardLike = Pick<Board, 'compounds' | 'grid' | 'id'> & {
  extra?: Board['extra']
  ttsCache?: unknown
}

// R2 lookups and Azure synthesis run a few at a time. One by one, saving a board with many cards
// took seconds: an R2 lookup for every card, then a synthesis for every new word. Kept low so a
// board full of new words doesn't run into Azure's rate limit.
const CACHE_CONCURRENCY = 6

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  const work = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index] as T)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, work))
  return results
}

function sanitizeVoiceForKey(voice: string): string {
  return voice.replace(/[^a-zA-Z0-9._-]+/g, '-')
}

// R2 key for synthesized speech. Boards and the homepage share it, so a word is synthesized once.
export function getTTSObjectKey(voice: string, hash: string, extension = 'mp3'): string {
  return `tts/ms/${sanitizeVoiceForKey(voice)}/${hash}.${extension}`
}

// A board with many verb cards and subjects has many forms; the most used are kept, and the rest are
// synthesized when the child says them, like any unsaved speech.
export const GRAMMAR_SPEECH_MAX = 120

export function collectBoardTTSInputs(
  board: Pick<Board, 'compounds' | 'grid'> & { extra?: Board['extra'] },
): Array<{
  source: BoardTTSCacheEntry['source']
  text: string
}> {
  const seen = new Set<string>()
  const inputs: Array<{ source: BoardTTSCacheEntry['source']; text: string }> = []

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

  // The forms the board's verb cards take in its sentences ("jooksen" after "mina").
  if (board.extra?.grammar !== false) {
    const cards = (board.grid?.cells ?? []).map((cell) => ({ text: cell.title ?? '', wordClass: cell.wordClass }))
    let kept = 0
    for (const form of boardVerbForms(cards)) {
      const prepared = prepareTextForTTS(form)
      if (!prepared || seen.has(prepared)) continue
      if (kept++ >= GRAMMAR_SPEECH_MAX) break
      seen.add(prepared)
      inputs.push({ source: 'grammar', text: prepared })
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

  const entries = await mapWithConcurrency(cacheInputs, CACHE_CONCURRENCY, async (input) => {
    const hash = getTTSCacheHash(input.text, voice)
    let objectKey = ''
    let contentType = 'audio/mpeg'
    const existingEntry = existingManifest.entries.find((entry) => entry.hash === hash)
    // A word form already in the manifest isn't looked up again: a board has many, and
    // /next/tts-cache makes one whose audio is missing.
    if (input.source === 'grammar' && existingEntry?.key) {
      return { ...existingEntry, source: input.source, url: buildBoardTTSCacheURL(boardId, hash) }
    }

    if (existingEntry?.key) {
      objectKey = existingEntry.key
      contentType = existingEntry.contentType
    } else {
      const audio = getTTSAudioMetadata()
      objectKey = getTTSObjectKey(voice, hash, audio.extension)
      contentType = audio.contentType
    }

    // A word Azure or R2 fails on doesn't fail the save: it stays in the manifest without its audio,
    // and /next/tts-cache synthesizes and stores it the first time it's asked for.
    try {
      const existingObject = await bucket.head(objectKey)
      if (!existingObject) {
        const synthesized = await synthesizeAzureSpeech({
          text: input.text,
          speaker: voice,
        })

        objectKey = getTTSObjectKey(voice, hash, synthesized.extension)
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
    } catch (error) {
      // The word itself stays out of the log: a child's board can be personal.
      console.error('Board speech not stored; /next/tts-cache will make it', {
        boardId,
        error: error instanceof Error ? error.message : String(error),
        hash,
      })
    }

    const entry: BoardTTSCacheEntry = {
      contentType,
      hash,
      key: objectKey,
      source: input.source,
      text: input.text,
      url: buildBoardTTSCacheURL(boardId, hash),
      voice,
    }
    return entry
  })

  return {
    entries: entries.sort((a, b) => a.text.localeCompare(b.text)),
    updatedAt: new Date().toISOString(),
  }
}
