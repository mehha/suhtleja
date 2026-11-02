import type { Payload, Where } from 'payload'

import type { User } from '@/payload-types'
import { memberBoardSpeech } from '@/utilities/azureTTS'
import { boardSpeechQuery, getBoardTTSCacheManifest } from '@/utilities/boardTTSCacheManifest'
import { serializeConnectDotsPuzzle } from '@/utilities/connectDots'
import { labelCase } from '@/utilities/labelCase'
import { getUserSharedHomePreferences, sortSharedDocs, toIdString } from '@/utilities/sharedHomePreferences'

// What a device keeps for the child to use without the network (GET /next/offline, see
// docs/rules/project/offline.md): the child's home, the boards on it and the boards their cards open,
// the games on it, and the speech and sounds these pages play. The pictures the browser finds in
// the pages themselves (src/utilities/offlineCache.ts).

/** The boards a device keeps at most: the home's first, then the ones their cards open. */
export const OFFLINE_MAX_BOARDS = 40

// Sounds every game plays (ConnectDotsGame.tsx).
const CONNECT_DOTS_SOUNDS = ['/connect-dots-success.mp3']

export type OfflinePage = {
  url: string
  // Changes when the page would show something else, so the device fetches it again.
  version: string
}

export type OfflineList = {
  userId: number
  pages: OfflinePage[]
  // Saved speech and sounds, by the URLs the pages ask for.
  media: string[]
}

type BoardEntry = {
  id: number
  updatedAt: string
  links: number[]
  media: string[]
}

type Dated = { id: number | string; updatedAt?: string | null }

// A short, stable fingerprint (FNV-1a) of what a page shows.
function versionOf(...parts: unknown[]): string {
  const text = JSON.stringify(parts)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

const dated = (docs: Dated[]) => docs.map((doc) => [doc.id, doc.updatedAt ?? ''])

export async function buildOfflineList(payload: Payload, user: User): Promise<OfflineList> {
  const preferences = getUserSharedHomePreferences(user)
  const speechQuery = boardSpeechQuery(memberBoardSpeech(user))
  // What every page shows of the member: the speech, the letters, the parent's PIN, the home's order.
  const userVersion = versionOf(speechQuery, labelCase(user.labelCase), Boolean(user.parentPinHash), preferences)
  const access = { overrideAccess: false, user } as const

  // The home's boards, as /kodu lists them.
  const [ownBoards, sharedBoards] = await Promise.all([
    payload.find({
      collection: 'boards',
      ...access,
      where: { and: [{ owner: { equals: user.id } }, { pinned: { equals: true } }] },
      sort: 'order',
      depth: 0,
      pagination: false,
      select: { order: true, owner: true, updatedAt: true },
    }),
    payload.find({
      collection: 'boards',
      ...access,
      where: { and: [{ visibleToAllUsers: { equals: true } }, { owner: { not_equals: user.id } }] },
      sort: 'order',
      depth: 0,
      pagination: false,
      select: { order: true, owner: true, updatedAt: true },
    }),
  ])
  const homeBoards = [
    ...ownBoards.docs,
    ...sortSharedDocs(
      sharedBoards.docs.filter((board) => !preferences.hiddenSharedBoardIds.includes(toIdString(board.id) ?? '')),
      preferences.sharedBoardOrder,
    ),
  ]

  // The boards, level by level: the home's, then the ones their cards open, which the member can read.
  const boards = new Map<number, BoardEntry>()
  let level = homeBoards.map((board) => board.id)
  while (level.length > 0 && boards.size < OFFLINE_MAX_BOARDS) {
    const ids = level.slice(0, OFFLINE_MAX_BOARDS - boards.size)
    const found = await payload.find({
      collection: 'boards',
      ...access,
      where: { id: { in: ids } },
      depth: 0,
      pagination: false,
      limit: ids.length,
      select: { grid: { cells: { linkBoard: true, locked: true } }, ttsCache: true, updatedAt: true },
    })
    const byId = new Map(found.docs.map((board) => [board.id, board]))
    const next: number[] = []
    for (const id of ids) {
      const board = byId.get(id)
      if (!board) continue
      const links = (board.grid?.cells ?? [])
        .filter((cell) => !cell.locked && typeof cell.linkBoard === 'number' && cell.linkBoard !== board.id)
        .map((cell) => cell.linkBoard as number)
      boards.set(id, {
        id,
        updatedAt: board.updatedAt,
        links: [...new Set(links)],
        media: getBoardTTSCacheManifest(board).entries.map((entry) => entry.url + speechQuery),
      })
      for (const link of links) if (!boards.has(link) && !next.includes(link)) next.push(link)
    }
    level = next.filter((id) => !boards.has(id))
  }

  // The games on the home, as /kodu lists them, and every game the game page lists.
  const enabled: Where = { enabled: { equals: true } }
  const [ownPuzzles, sharedPuzzles, listedPuzzles] = await Promise.all([
    payload.find({
      collection: 'connect-dots-puzzles',
      ...access,
      where: { and: [enabled, { owner: { equals: user.id } }, { pinned: { equals: true } }] },
      sort: 'order',
      depth: 0,
      pagination: false,
      select: { order: true, owner: true, updatedAt: true },
    }),
    payload.find({
      collection: 'connect-dots-puzzles',
      ...access,
      where: { and: [enabled, { visibleToAllUsers: { equals: true } }, { owner: { not_equals: user.id } }] },
      sort: 'order',
      depth: 0,
      pagination: false,
      select: { order: true, owner: true, updatedAt: true },
    }),
    // The game page's own query (connect-dots/page.tsx).
    payload.find({
      collection: 'connect-dots-puzzles',
      ...access,
      where:
        user.role === 'admin'
          ? enabled
          : { and: [enabled, { or: [{ owner: { equals: user.id } }, { visibleToAllUsers: { equals: true } }] }] },
      sort: 'order',
      depth: 1,
      pagination: false,
    }),
  ])
  const homePuzzles = [
    ...ownPuzzles.docs,
    ...sortSharedDocs(
      sharedPuzzles.docs.filter((puzzle) => !preferences.hiddenSharedPuzzleIds.includes(toIdString(puzzle.id) ?? '')),
      preferences.sharedPuzzleOrder,
    ),
  ]

  const pages: OfflinePage[] = [
    { url: '/kodu', version: versionOf(dated(homeBoards), dated(homePuzzles), userVersion) },
  ]
  const media: string[] = []
  // A board shows the names of the boards its cards open, and of the one it was opened from.
  const boardVersion = (board: BoardEntry, ...more: unknown[]) =>
    versionOf(board.updatedAt, board.links.map((id) => [id, boards.get(id)?.updatedAt ?? '']), userVersion, ...more)
  for (const board of boards.values()) {
    pages.push({ url: `/boards/${board.id}`, version: boardVersion(board) })
    media.push(...board.media)
  }
  // A card that opens a board goes there with a back button (`?from=`).
  for (const board of boards.values()) {
    for (const link of board.links) {
      const target = boards.get(link)
      if (target) pages.push({ url: `/boards/${link}?from=${board.id}`, version: boardVersion(target, board.updatedAt) })
    }
  }

  if (homePuzzles.length > 0) {
    const gamesVersion = versionOf(dated(listedPuzzles.docs), userVersion)
    for (const puzzle of homePuzzles) pages.push({ url: `/connect-dots?puzzle=${puzzle.id}`, version: gamesVersion })
    media.push(...CONNECT_DOTS_SOUNDS)
    for (const doc of listedPuzzles.docs) {
      const music = serializeConnectDotsPuzzle(doc as unknown as Record<string, unknown>)?.backgroundMusicUrl
      if (music) media.push(music)
    }
  }

  return { userId: user.id, pages, media: [...new Set(media)] }
}
