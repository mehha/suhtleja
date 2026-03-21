import type { Board } from '@/payload-types'
import { DEFAULT_TTS_VOICE } from '@/utilities/azureTTS'
import { getServerSideURL } from '@/utilities/getURL'

export type BoardTTSCacheEntry = {
  contentType: string
  hash: string
  key: string
  source: 'cell' | 'compound'
  text: string
  url: string
  voice: string
}

export type BoardTTSCacheManifest = {
  entries: BoardTTSCacheEntry[]
  updatedAt: string
}

type BoardLike = Pick<Board, 'id'> & {
  ttsCache?: unknown
}

function toObjectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function toEntrySource(value: unknown): BoardTTSCacheEntry['source'] {
  return value === 'compound' ? 'compound' : 'cell'
}

export function buildBoardTTSCacheURL(boardId: string | number, hash: string): string {
  return `${getServerSideURL()}/next/tts-cache/${encodeURIComponent(String(boardId))}/${hash}`
}

export function getBoardTTSCacheManifest(board: BoardLike | null | undefined): BoardTTSCacheManifest {
  const raw = toObjectValue(board?.ttsCache)
  const rawEntries = Array.isArray(raw?.entries) ? raw.entries : []

  const entries = rawEntries
    .map((entry) => toObjectValue(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      contentType:
        typeof entry.contentType === 'string' ? entry.contentType : 'audio/mpeg',
      hash: typeof entry.hash === 'string' ? entry.hash : '',
      key: typeof entry.key === 'string' ? entry.key : '',
      source: toEntrySource(entry.source),
      text: typeof entry.text === 'string' ? entry.text : '',
      url: typeof entry.url === 'string' ? entry.url : '',
      voice: typeof entry.voice === 'string' ? entry.voice : DEFAULT_TTS_VOICE,
    }))
    .filter((entry) => entry.hash && entry.key && entry.text && entry.url)

  return {
    entries,
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : '',
  }
}
