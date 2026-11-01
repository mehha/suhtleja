// @vitest-environment node

// Word classes of board cards (src/utilities/wordClass.ts): the class the card editor suggests from
// a card's text, the picture bank categories behind it, and the lookup /next/word-class runs
// (src/utilities/wordClassLookup.ts). The Payload tests use their own root folder, so they never
// touch an imported "Pildipank".

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import {
  MAPPED_PICTURE_BANK_CATEGORIES,
  WORD_CLASSES,
  WORD_CLASS_INFO,
  guessWordClass,
  pictureBankCategoryWordClass,
  wordClassColor,
} from '@/utilities/wordClass'
import { findWordClasses } from '@/utilities/wordClassLookup'
import { CATEGORY_ORDER } from '../../scripts/pildipank/lib'

describe('word class suggestions', () => {
  it('knows pronouns in the cases children use', () => {
    for (const word of ['mina', 'Mina', ' ma ', 'mulle', 'sind', 'talle', 'meie', 'nemad']) {
      expect(guessWordClass(word), word).toBe('person')
    }
  })

  it('takes a one-word ma-infinitive for a verb, but not ema or tema', () => {
    expect(guessWordClass('jooksma')).toBe('verb')
    expect(guessWordClass('Sööma')).toBe('verb')
    expect(guessWordClass('mängima')).toBe('verb')
    expect(guessWordClass('ema')).toBeNull()
    expect(guessWordClass('vanaema')).toBeNull()
    expect(guessWordClass('pidžaama')).toBeNull()
    expect(guessWordClass('mul on vaja')).toBeNull()
  })

  it('lets the word rules win over a category that files a word elsewhere', () => {
    // The picture bank has "laulma" under Inimesed, "mina" and "anna" under Suhtlemine.
    expect(guessWordClass('laulma', 'Inimesed')).toBe('verb')
    expect(guessWordClass('mina', 'Suhtlemine')).toBe('person')
    expect(guessWordClass('anna', 'Suhtlemine')).toBe('verb')
    expect(guessWordClass('kus', 'Küsisõnad')).toBe('question')
  })

  it('falls back to the picture bank category', () => {
    expect(guessWordClass('koer', 'Loomad')).toBe('noun')
    expect(guessWordClass('pood', 'Kohad')).toBe('place')
    expect(guessWordClass('rõõmus', 'Tunded')).toBe('adjective')
    expect(guessWordClass('veel', 'Põhisõnad')).toBe('other')
    expect(guessWordClass('head aega', 'Suhtlemine')).toBe('social')
  })

  it('knows a few social words without a picture, and nothing about other words', () => {
    expect(guessWordClass('aitäh')).toBe('social')
    expect(guessWordClass('kui palju')).toBe('question')
    expect(guessWordClass('palju')).toBeNull()
    expect(guessWordClass('koer')).toBeNull()
    expect(guessWordClass('   ')).toBeNull()
  })

  it('maps every picture bank category, and only those', () => {
    expect([...MAPPED_PICTURE_BANK_CATEGORIES].sort()).toEqual([...CATEGORY_ORDER].sort())
    expect(pictureBankCategoryWordClass('Tundmatu')).toBeNull()
  })

  it('gives every class its own colour, and none to a card without one', () => {
    const colors = WORD_CLASSES.map((value) => WORD_CLASS_INFO[value].color)
    expect(new Set(colors).size).toBe(WORD_CLASSES.length)
    expect(wordClassColor('verb')).toBe(WORD_CLASS_INFO.verb.color)
    expect(wordClassColor(null)).toBeNull()
    expect(wordClassColor('verbs')).toBeNull()
  })
})

describe('word class lookup', () => {
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const rootName = `Pildipank-wordclass-${run}`
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  )
  let payload: Payload
  const created: Array<{ collection: 'media' | 'payload-folders'; id: number }> = []

  const folder = async (name: string, parent?: number) => {
    const doc = await payload.create({
      collection: 'payload-folders',
      data: { folder: parent, folderType: ['media'], name },
      overrideAccess: true,
    })
    created.push({ collection: 'payload-folders', id: doc.id })
    return doc.id
  }
  const picture = async (alt: string, folderId: number) => {
    const doc = await payload.create({
      collection: 'media',
      data: { alt, folder: folderId } as never,
      file: { data: tinyPng, mimetype: 'image/png', name: `wordclass-${run}.png`, size: tinyPng.length },
      overrideAccess: true,
    })
    created.push({ collection: 'media', id: doc.id })
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    const root = await folder(rootName)
    const animals = await folder('Loomad', root)
    const people = await folder('Inimesed', root)
    const places = await folder('Kohad', root)
    const outside = await folder(`Muu-${run}`)
    await picture('koer', animals)
    await picture('laulma', people)
    await picture('ema', people)
    await picture('pood', places)
    // Not in the bank: a library picture elsewhere says nothing about the word.
    await picture('kass', outside)
  })

  afterAll(async () => {
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => {})
    }
  })

  it("suggests each card's class from the word rules and the bank picture's category", async () => {
    expect(await findWordClasses(payload, ['Koer', 'laulma', 'ema', 'pood', 'mina', 'kass', 'xyz'], rootName)).toEqual({
      Koer: 'noun',
      laulma: 'verb',
      ema: 'person',
      pood: 'place',
      mina: 'person',
      kass: null,
      xyz: null,
    })
  })

  it('answers from the word rules alone without a picture bank', async () => {
    expect(await findWordClasses(payload, ['koer', 'jooksma'], `Puudub-${run}`)).toEqual({
      koer: null,
      jooksma: 'verb',
    })
  })
})
