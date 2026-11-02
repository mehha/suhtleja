import { randomUUID } from 'crypto'
import type { Payload } from 'payload'

import type { User } from '@/payload-types'
import { PICTURE_BANK_FOLDER_NAME } from './findLibraryMedia'
import { guessWordClass, normalizeWord, type WordClass } from './wordClass'
import { findPictureBankMedia, type PictureBankMedia } from './wordClassLookup'

// The starter set (docs/rules/project/boards.md, "Starter set"): five boards a new parent makes with
// one tap, linked from the core words board to the four topic boards. Every word is a picture bank
// word, so the cards get its picture and word class, and they are chosen for the board's word forms:
// "mina tahan õuna", "lähen parki", "mina olen rõõmus", "mängin autoga".

type StarterKey = 'core' | 'food' | 'play' | 'feelings' | 'places'

// A word, or a card that opens a topic board (its title, and the bank word whose picture it shows).
type StarterCard = string | { opens: StarterKey; title: string; picture: string }

export type StarterBoard = { key: StarterKey; name: string; cards: StarterCard[] }

// Six columns: an upright tablet shows them as made.
export const STARTER_COLS = 6

export const STARTER_BOARDS: StarterBoard[] = [
  // The core words first: the boards are listed (Koduhaldus, the home) in the order they're made.
  {
    key: 'core',
    name: 'Põhisõnad',
    cards: [
      ...['mina', 'sina', 'tema', 'ema', 'isa', 'meie'],
      ...['tahtma', 'ei', 'jah', 'veel', 'palun', 'aitäh'],
      ...['minema', 'sööma', 'jooma', 'mängima', 'aitama', 'olema'],
      { opens: 'food', title: 'Söök', picture: 'söök' },
      { opens: 'play', title: 'Mängimine', picture: 'pall' },
      { opens: 'feelings', title: 'Tunded', picture: 'rõõmus' },
      { opens: 'places', title: 'Kohad', picture: 'kodu' },
      'see',
      'koos',
    ],
  },
  {
    key: 'food',
    name: 'Söök ja jook',
    cards: [
      ...['sööma', 'jooma', 'tahtma', 'veel', 'aitäh', 'ei'],
      ...['vesi', 'piim', 'mahl', 'leib', 'õun', 'banaan'],
      ...['puder', 'supp', 'jäätis', 'küpsis', 'juust', 'kartul'],
    ],
  },
  {
    key: 'play',
    name: 'Mängimine',
    cards: [
      ...['mängima', 'ehitama', 'joonistama', 'tahtma', 'koos', 'veel'],
      ...['pall', 'auto', 'nukk', 'klotsid', 'pusle', 'raamat'],
      ...['õu', 'kiik', 'liumägi', 'liivakast', 'mänguväljak', 'sõber'],
    ],
  },
  {
    key: 'feelings',
    name: 'Tunded',
    cards: [
      ...['mina', 'sina', 'tema', 'olema', 'ei', 'väga'],
      ...['rõõmus', 'kurb', 'vihane', 'väsinud', 'hirmul', 'haige'],
      ...['valus', 'näljane', 'janune', 'igav', 'rahulik', 'üllatunud'],
    ],
  },
  {
    key: 'places',
    name: 'Kohad',
    cards: [
      ...['minema', 'tulema', 'olema', 'tahtma', 'eile', 'homme'],
      ...['kodu', 'lasteaed', 'pood', 'park', 'mänguväljak', 'õu'],
      ...['auto', 'buss', 'rong', 'vanaema', 'juurde', 'mets'],
    ],
  },
]

// The class of the words the word rules (guessWordClass) leave without one, so the colours and the
// word forms are the same with or without a picture bank ("kiik" a place: "lähen kiigele").
const STARTER_CLASSES: Record<string, WordClass> = {
  ...Object.fromEntries(['ema', 'isa', 'vanaema', 'sõber'].map((word) => [word, 'person' as const])),
  ...Object.fromEntries(
    [
      ...['vesi', 'piim', 'mahl', 'leib', 'õun', 'banaan', 'puder', 'supp', 'jäätis', 'küpsis', 'juust'],
      ...['kartul', 'pall', 'auto', 'nukk', 'klotsid', 'pusle', 'raamat', 'buss', 'rong'],
    ].map((word) => [word, 'noun' as const]),
  ),
  ...Object.fromEntries(
    [
      ...['rõõmus', 'kurb', 'vihane', 'väsinud', 'hirmul', 'haige', 'valus', 'näljane', 'janune'],
      ...['igav', 'rahulik', 'üllatunud'],
    ].map((word) => [word, 'adjective' as const]),
  ),
  ...Object.fromEntries(
    ['õu', 'kiik', 'liumägi', 'liivakast', 'mänguväljak', 'kodu', 'lasteaed', 'pood', 'park', 'mets'].map(
      (word) => [word, 'place' as const],
    ),
  ),
  ...Object.fromEntries(['veel', 'koos', 'väga', 'eile', 'homme', 'juurde', 'see'].map((word) => [word, 'other' as const])),
}

/** A starter word's class: the word rules', else the starter set's own, else the picture bank's. */
export function starterWordClass(word: string, category?: string): WordClass | null {
  return guessWordClass(word) ?? STARTER_CLASSES[word] ?? guessWordClass(word, category)
}

const pictureWord = (card: StarterCard) => (typeof card === 'string' ? card : card.picture)

// A board's cards in reading order, with the bank's pictures; a card that opens a board gets its
// link once that board exists.
function starterGrid(board: StarterBoard, pictures: Map<string, PictureBankMedia>) {
  const cells = board.cards.map((card, index) => {
    const word = pictureWord(card)
    const picture = pictures.get(normalizeWord(word))
    return {
      id: randomUUID(),
      x: index % STARTER_COLS,
      y: Math.floor(index / STARTER_COLS),
      w: 1,
      h: 1,
      title: typeof card === 'string' ? card : card.title,
      ...(picture ? { image: picture.id } : {}),
      ...(typeof card === 'string' ? { wordClass: starterWordClass(card, picture?.category) } : {}),
      linkBoard: undefined as number | undefined,
    }
  })
  return { cols: STARTER_COLS, rows: Math.ceil(cells.length / STARTER_COLS), cells }
}

/**
 * Makes the starter set as the user's own boards (with their access: a membership is needed) and
 * returns the core words board's id, which is on the home; the topic boards open from it. With
 * `speech`, each board's speech cache is made as on a save.
 */
export async function createStarterBoardsForUser(
  payload: Payload,
  user: User,
  { speech = true, rootName = PICTURE_BANK_FOLDER_NAME }: { speech?: boolean; rootName?: string } = {},
): Promise<{ coreId: number; ids: number[] }> {
  const words = STARTER_BOARDS.flatMap((board) => board.cards.map(pictureWord))
  const pictures = await findPictureBankMedia(payload, words, rootName)
  const ids = new Map<StarterKey, number>()
  const grids = new Map<StarterKey, ReturnType<typeof starterGrid>>()

  for (const board of STARTER_BOARDS) {
    const grid = starterGrid(board, pictures)
    const created = await payload.create({
      collection: 'boards',
      data: {
        name: board.name,
        // Only the core words go on the home; the child gets to the others through them.
        pinned: board.key === 'core',
        actionBar: { enabled: true },
        extra: { ai: false, wordClassColors: true, grammar: true },
        grid,
      } as never,
      depth: 0,
      overrideAccess: false,
      user,
    })
    ids.set(board.key, created.id)
    grids.set(board.key, grid)
  }

  // The core words' cards open the topic boards, which exist now. A save also makes the speech cache
  // (the boards' hook runs on updates), so the words play at once.
  for (const board of STARTER_BOARDS) {
    const grid = grids.get(board.key)!
    const links = board.cards.flatMap((card, index) => (typeof card === 'string' ? [] : [{ index, opens: card.opens }]))
    if (!links.length && !speech) continue

    for (const { index, opens } of links) grid.cells[index]!.linkBoard = ids.get(opens)
    await payload.update({
      collection: 'boards',
      id: ids.get(board.key)!,
      data: { grid } as never,
      depth: 0,
      overrideAccess: false,
      user,
    })
  }

  return { coreId: ids.get('core')!, ids: STARTER_BOARDS.map((board) => ids.get(board.key)!) }
}
