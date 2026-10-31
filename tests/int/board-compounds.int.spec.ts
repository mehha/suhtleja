import { describe, expect, it } from 'vitest'

import {
  applyCompounds,
  type Compound,
  type SelectedToken,
} from '@/app/(frontend)/boards/[id]/compounds/applyCompounds'
import { getCompoundFormForLastToken } from '@/app/(frontend)/boards/[id]/compounds/getCompoundFormForLastToken'
import {
  COMPOUND_MISSING_CELL,
  COMPOUND_MISSING_WORD,
  COMPOUND_TOO_SHORT,
  findCompoundsProblem,
  getCompoundProblem,
} from '@/app/(frontend)/boards/[id]/compounds/validateCompounds'

// Cells are named by their word, so a sequence reads like the sentence a child taps.
const tap = (...words: string[]): SelectedToken[] => words.map((word) => ({ id: word, text: word }))

const compound = (id: string, parts: Array<[cellId: string, surface: string, tts?: string]>): Compound => ({
  id,
  cells: parts.map(([cellId]) => ({ cellId })),
  parts: parts.map(([, surface, tts]) => ({ surface, tts: tts ?? null })),
})

const kaksKassi = compound('kaks-kass', [
  ['kaks', 'kaks'],
  ['kass', 'kassi'],
])

const kaksSuurtKassi = compound('kaks-suur-kass', [
  ['kaks', 'kaks'],
  ['suur', 'suurt'],
  ['kass', 'kassi'],
])

describe('applyCompounds', () => {
  it('keeps the words as tapped without compounds', () => {
    expect(applyCompounds(tap('mina', 'tahan'), null)).toMatchObject({
      display: 'mina tahan',
      tts: 'mina tahan',
    })
    expect(applyCompounds([], [kaksKassi])).toMatchObject({ display: '', tts: '', tokens: [] })
  })

  it('gives the words of a whole compound their forms', () => {
    const result = applyCompounds(tap('mul', 'on', 'kaks', 'kass'), [kaksKassi])
    expect(result.display).toBe('mul on kaks kassi')
    expect(result.tts).toBe('mul on kaks kassi')
    expect(result.tokens.map((t) => t.compoundId)).toEqual([undefined, undefined, 'kaks-kass', 'kaks-kass'])
  })

  it('matches every occurrence, and only the cells in order', () => {
    expect(applyCompounds(tap('kaks', 'kass', 'ja', 'kaks', 'kass'), [kaksKassi]).display).toBe(
      'kaks kassi ja kaks kassi',
    )
    expect(applyCompounds(tap('kass', 'kaks'), [kaksKassi]).display).toBe('kass kaks')
    expect(applyCompounds(tap('kaks', 'suur', 'kass'), [kaksKassi]).display).toBe('kaks suur kass')
    expect(applyCompounds(tap('kaks'), [kaksKassi]).display).toBe('kaks')
  })

  it('says the speech form where one is set, and the written form otherwise', () => {
    const spelled = compound('spelled', [
      ['kaks', 'kaks'],
      ['kass', 'kassi', 'kas-si'],
    ])
    expect(applyCompounds(tap('kaks', 'kass'), [spelled])).toMatchObject({
      display: 'kaks kassi',
      tts: 'kaks kas-si',
    })

    const blankSpeech = compound('blank', [
      ['kaks', 'kaks', '  '],
      ['kass', ' kassi ', ''],
    ])
    expect(applyCompounds(tap('kaks', 'kass'), [blankSpeech]).tts).toBe('kaks kassi')
  })

  it('ignores a compound whose words and cells differ in number', () => {
    const broken: Compound = { id: 'broken', cells: [{ cellId: 'kaks' }, { cellId: 'kass' }], parts: [{ surface: 'kahe' }] }
    expect(applyCompounds(tap('kaks', 'kass'), [broken]).display).toBe('kaks kass')
  })

  it('gives overlapping words the form of the longer compound, whatever the order', () => {
    // "suur kass" alone is in the nominative; inside "kaks suur kass" it takes the partitive.
    const suurKass = compound('suur-kass', [
      ['suur', 'suur'],
      ['kass', 'kass'],
    ])
    for (const rules of [
      [suurKass, kaksSuurtKassi],
      [kaksSuurtKassi, suurKass],
    ]) {
      expect(applyCompounds(tap('kaks', 'suur', 'kass'), rules).display).toBe('kaks suurt kassi')
      expect(applyCompounds(tap('üks', 'suur', 'kass'), rules).display).toBe('üks suur kass')
    }
  })

  it('lets the earlier of two equally long compounds win', () => {
    const kaksKasse = compound('kaks-kasse', [
      ['kaks', 'kaks'],
      ['kass', 'kasse'],
    ])
    expect(applyCompounds(tap('kaks', 'kass'), [kaksKassi, kaksKasse]).display).toBe('kaks kassi')
    expect(applyCompounds(tap('kaks', 'kass'), [kaksKasse, kaksKassi]).display).toBe('kaks kasse')
  })
})

describe('getCompoundFormForLastToken', () => {
  it('returns nothing when no compound applies', () => {
    expect(getCompoundFormForLastToken(tap('kass'), null)).toBeNull()
    expect(getCompoundFormForLastToken([], [kaksKassi])).toBeNull()
    expect(getCompoundFormForLastToken(tap('koer'), [kaksKassi])).toBeNull()
    expect(getCompoundFormForLastToken(tap('kass'), [kaksKassi])).toBeNull()
  })

  it('says the last word of a whole compound in its form', () => {
    const spelled = compound('spelled', [
      ['kaks', 'kaks'],
      ['kass', 'kassi', 'kas-si'],
    ])
    expect(getCompoundFormForLastToken(tap('mul', 'on', 'kaks', 'kass'), [spelled])).toEqual({
      surface: 'kassi',
      tts: 'kas-si',
    })
  })

  it('says a word as tapped while its compound is only started', () => {
    expect(getCompoundFormForLastToken(tap('kaks'), [kaksSuurtKassi])).toBeNull()
    expect(getCompoundFormForLastToken(tap('kaks', 'suur'), [kaksSuurtKassi])).toBeNull()
    expect(getCompoundFormForLastToken(tap('kaks', 'suur', 'kass'), [kaksSuurtKassi])).toEqual({
      surface: 'kassi',
      tts: 'kassi',
    })
  })

  it('uses a whole compound even when a longer one is started', () => {
    // "kaks kass" is whole; "mul kaks kass sööb" is only started, with "kass" in another form.
    const longer = compound('longer', [
      ['mul', 'mul'],
      ['kaks', 'kaks'],
      ['kass', 'kassi-pikk'],
      ['sööb', 'sööb'],
    ])
    expect(getCompoundFormForLastToken(tap('mul', 'kaks', 'kass'), [longer, kaksKassi])).toEqual({
      surface: 'kassi',
      tts: 'kassi',
    })
  })

  it('says each tapped word the way the whole phrase says it', () => {
    const suurKass = compound('suur-kass', [
      ['suur', 'suur'],
      ['kass', 'kass'],
    ])
    const kaksKasse = compound('kaks-kasse', [
      ['kaks', 'kaks'],
      ['kass', 'kasse'],
    ])
    const ruleSets = [
      [kaksKassi, kaksSuurtKassi, suurKass],
      [suurKass, kaksSuurtKassi, kaksKasse, kaksKassi],
      [kaksKasse, kaksKassi],
    ]
    const sentences = [
      tap('kaks', 'kass'),
      tap('kaks', 'suur', 'kass', 'ja', 'suur', 'kass'),
      tap('kass', 'kaks', 'kass', 'kaks', 'kass'),
    ]

    for (const rules of ruleSets) {
      for (const sentence of sentences) {
        for (let length = 1; length <= sentence.length; length++) {
          const tapped = sentence.slice(0, length)
          const phraseWord = applyCompounds(tapped, rules).tokens.at(-1)!
          if (!phraseWord.compoundId) continue

          expect(getCompoundFormForLastToken(tapped, rules), tapped.map((t) => t.id).join(' ')).toEqual({
            surface: phraseWord.surface,
            tts: phraseWord.tts,
          })
        }
      }
    }
  })
})

describe('compound validation', () => {
  it('accepts a compound of two or more cells with a word for each', () => {
    expect(getCompoundProblem(kaksKassi)).toBeNull()
    expect(getCompoundProblem(kaksSuurtKassi)).toBeNull()
    expect(findCompoundsProblem([kaksKassi, kaksSuurtKassi])).toBeNull()
    expect(findCompoundsProblem([])).toBeNull()
  })

  it('names what is missing', () => {
    expect(getCompoundProblem(compound('one', [['kass', 'kassi']]))).toBe(COMPOUND_TOO_SHORT)
    expect(getCompoundProblem({ id: 'empty', cells: null, parts: null })).toBe(COMPOUND_TOO_SHORT)
    expect(getCompoundProblem(compound('no-cell', [['kaks', 'kaks'], ['', 'kassi']]))).toBe(COMPOUND_MISSING_CELL)
    expect(getCompoundProblem(compound('no-word', [['kaks', 'kaks'], ['kass', '  ']]))).toBe(COMPOUND_MISSING_WORD)
    expect(
      getCompoundProblem({ id: 'short-parts', cells: kaksKassi.cells, parts: [{ surface: 'kaks' }] }),
    ).toBe(COMPOUND_MISSING_WORD)
    expect(findCompoundsProblem([kaksKassi, compound('one', [['kass', 'kassi']])])).toBe(COMPOUND_TOO_SHORT)
  })
})
