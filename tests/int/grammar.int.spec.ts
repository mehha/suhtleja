// @vitest-environment node

// The board's word forms (src/utilities/grammar): real sentences a child taps, card by card, and
// the words the board says. Every rule has sentences that must stay as tapped, so a rule never
// reaches words it doesn't know (another AAC app said "jooksen staadionisse juustu").

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { applyCompounds } from '@/app/(frontend)/boards/[id]/compounds/applyCompounds'
import { collectBoardTTSInputs, GRAMMAR_SPEECH_MAX } from '@/utilities/boardTTSCache'
import { applyGrammar, boardVerbForms, verbCard, verbForm } from '@/utilities/grammar/applyGrammar'
import { VERB_FORMS } from '@/utilities/grammar/verbForms'

// Cards as "word" or "word:class".
const say = (...cards: string[]) =>
  applyGrammar(
    cards.map((card) => {
      const [text, wordClass] = card.split(':')
      return { text: text!, wordClass: wordClass ?? null }
    }),
  ).join(' ')

describe('word forms', () => {
  it.each([
    // A subject and a verb
    [['mina', 'jooksma'], 'mina jooksen'],
    [['ma', 'sööma'], 'ma söön'],
    [['sina', 'tulema'], 'sina tuled'],
    [['tema', 'sööma'], 'tema sööb'],
    [['meie', 'mängima'], 'meie mängime'],
    [['teie', 'magama'], 'teie magate'],
    [['nemad', 'jooksma'], 'nemad jooksevad'],
    [['mina', 'minema'], 'mina lähen'],
    [['meie', 'minema'], 'meie läheme'],
    [['mina', 'olema'], 'mina olen'],
    [['tema', 'olema'], 'tema on'],
    [['nemad', 'olema'], 'nemad on'],
    [['mina', 'tegema'], 'mina teen'],
    [['sina', 'nägema'], 'sina näed'],
    [['mina', 'kukkuma'], 'mina kukun'],
    [['tema', 'rääkima'], 'tema räägib'],
    // People and "see"
    [['ema', 'magama'], 'ema magab'],
    [['õpetaja', 'tulema'], 'õpetaja tuleb'],
    [['lapsed', 'mängima'], 'lapsed mängivad'],
    [['see', 'olema', 'pall'], 'see on pall'],
    [['kes', 'tulema'], 'kes tuleb'],
    [['vanaema Malle:person', 'tulema'], 'vanaema Malle tuleb'],
    // Joined subjects
    [['mina', 'ja', 'sina', 'mängima'], 'mina ja sina mängime'],
    [['mina', 'ja', 'ema', 'minema'], 'mina ja ema läheme'],
    [['sina', 'ja', 'ema', 'tulema'], 'sina ja ema tulete'],
    [['ema', 'ja', 'isa', 'magama'], 'ema ja isa magavad'],
    // Negation
    [['mina', 'ei', 'tahtma'], 'mina ei taha'],
    [['ei', 'tahtma'], 'ei taha'],
    [['tema', 'ei', 'olema', 'kodus'], 'tema ei ole kodus'],
    [['mina', 'ei', 'minema'], 'mina ei lähe'],
    // Two verbs
    [['mina', 'tahtma', 'sööma'], 'mina tahan süüa'],
    [['mina', 'ei', 'tahtma', 'magama'], 'mina ei taha magada'],
    [['mina', 'pidama', 'minema'], 'mina pean minema'],
    [['mina', 'minema', 'ujuma'], 'mina lähen ujuma'],
    [['mina', 'tahtma', 'minema', 'mängima'], 'mina tahan minna mängima'],
    [['tema', 'oskama', 'ujuma'], 'tema oskab ujuda'],
    [['mina', 'tahtma', 'ema', 'kallistama'], 'mina tahan ema kallistada'],
    // A card that already is a form
    [['tahan', 'sööma'], 'tahan süüa'],
    [['mina', 'tahan', 'mängima'], 'mina tahan mängida'],
    [['tahan', 'proovida', 'hüppama'], 'tahan proovida hüpata'],
    // "mul on", "mulle meeldib"
    [['mul', 'olema', 'pall'], 'mul on pall'],
    [['mul', 'ei', 'olema'], 'mul ei ole'],
    [['mulle', 'meeldima', 'joonistama'], 'mulle meeldib joonistada'],
    // Phrases of a verb
    [['mina', 'hambaid pesema'], 'mina pesen hambaid'],
    [['tema', 'õue minema'], 'tema läheb õue'],
    [['mina', 'ei', 'hambaid pesema'], 'mina ei pese hambaid'],
    [['mina', 'tahtma', 'hambaid pesema'], 'mina tahan hambaid pesta'],
    // Clauses
    [['mina', 'sööma', 'ja', 'tema', 'jooma'], 'mina söön ja tema joob'],
    [['mina', 'sööma', 'ja', 'jooma'], 'mina söön ja joon'],
    [['mina', 'tahtma', 'aga', 'ei', 'saama'], 'mina tahan aga ei saa'],
    [['kui', 'sina', 'tulema', 'siis', 'mina', 'minema'], 'kui sina tuled siis mina lähen'],
    [['kas', 'sina', 'tulema'], 'kas sina tuled'],
    // Capitals as on the card
    [['Mina', 'Jooksma'], 'Mina Jooksen'],
    [['MINA', 'JOOKSMA'], 'MINA JOOKSEN'],
  ])('%j says "%s"', (cards, expected) => {
    expect(say(...cards)).toBe(expected)
  })

  it.each([
    // No subject, no "ei": the verb is as the card says
    [['jooksma']],
    [['tahtma', 'sööma']],
    // A thing is not a subject: "pall viskama" means "viskan palli"
    [['pall', 'viskama']],
    [['kass', 'jooksma']],
    // A word the list doesn't know, and words that only look like verbs
    [['mina', 'kirjeldama']],
    [['mina', 'ema']],
    [['mina', 'pidžaama']],
    // Classed as something else by the parent
    [['mina', 'jooksma:noun']],
    // A pronoun in another case is not a subject
    [['mind', 'kallistama']],
    [['minu', 'magama']],
    // A verb form classed as something else ("palun" is "please") doesn't start a verb chain
    [['palun:social', 'sööma']],
  ])('%j stays as tapped', (cards) => {
    expect(say(...cards)).toBe(cards.map((card) => card.split(':')[0]).join(' '))
  })

  it('changes only the verb: nouns keep their form', () => {
    expect(say('mina', 'jooksma', 'staadion', 'juust')).toBe('mina jooksen staadion juust')
    expect(say('mina', 'tahtma', 'õun')).toBe('mina tahan õun')
  })

  it('follows a pronoun over a person or "see" when two come without "ja"', () => {
    expect(say('mina', 'ema', 'kallistama')).toBe('mina ema kallistan')
    expect(say('ema', 'mina', 'kallistama')).toBe('ema mina kallistan')
    expect(say('mina', 'sina', 'kallistama')).toBe('mina sina kallistan')
  })

  it('gives each card of a compound its own form under the compound', () => {
    const cards = [
      { id: 'a', text: 'mina' },
      { id: 'b', text: 'jooksma' },
    ]
    const forms = applyGrammar(cards)
    const tokens = cards.map((card, index) => ({ id: card.id, text: forms[index]! }))
    // A compound that keeps the infinitive wins over the rule.
    const compound = {
      id: 'c',
      cells: [{ cellId: 'a' }, { cellId: 'b' }],
      parts: [{ surface: 'mina' }, { surface: 'jooksma' }],
    }
    expect(applyCompounds(tokens, [compound as never]).display).toBe('mina jooksma')
    // A compound part without a word takes the word's form.
    const empty = { ...compound, parts: [{ surface: '' }, { surface: '' }] }
    expect(applyCompounds(tokens, [empty as never]).display).toBe('mina jooksen')
  })
})

describe('the verb list', () => {
  it('has every verb of the picture bank', () => {
    const csv = readFileSync(path.resolve(__dirname, '../../scripts/pildipank/sonavara.csv'), 'utf8')
    const header = csv.split('\n')[0]!.split(',')
    const word = header.indexOf('sõna')
    const category = header.indexOf('kategooria')
    const verbs = csv
      .split('\n')
      .slice(1)
      .map((line) => line.split(','))
      .filter((row) => row[category] === 'Tegevused')
      .map((row) => row[word]!.trim())
    expect(verbs.length).toBeGreaterThan(100)
    expect(verbs.filter((text) => !verbCard(text, 'verb'))).toEqual([])
  })

  it('has a stem and a da-infinitive for every verb', () => {
    for (const [verb, [stem, da]] of Object.entries(VERB_FORMS)) {
      expect(verb, verb).toMatch(/ma$/)
      expect(stem.length, verb).toBeGreaterThan(0)
      expect(da, verb).toMatch(/(da|ta|a)$/)
    }
  })

  it('says a verb card in every form', () => {
    const card = verbCard('jooksma')!
    expect(['1sg', '2sg', '3sg', '1pl', '2pl', '3pl', 'neg', 'da'].map((kind) => verbForm(card, kind as never))).toEqual([
      'jooksen',
      'jooksed',
      'jookseb',
      'jookseme',
      'jooksete',
      'jooksevad',
      'jookse',
      'joosta',
    ])
  })
})

describe('the forms a board can say', () => {
  const cards = (...texts: string[]) => texts.map((text) => ({ text }))

  it('has the persons of its subjects, "ei" and the da-infinitive', () => {
    expect(boardVerbForms(cards('mina', 'tema', 'jooksma', 'pall'))).toEqual(['jooksen', 'jookseb'])
    expect(boardVerbForms(cards('mina', 'ei', 'tahtma', 'sööma'))).toEqual(['tahan', 'söön', 'taha', 'söö', 'tahta', 'süüa'])
  })

  it('has the plurals when the board has "ja"', () => {
    expect(boardVerbForms(cards('mina', 'ema', 'ja', 'minema'))).toEqual(['lähen', 'läheb', 'läheme', 'lähevad'])
  })

  it('has nothing without a subject, "ei" or a verb', () => {
    expect(boardVerbForms(cards('jooksma', 'sööma'))).toEqual([])
    expect(boardVerbForms(cards('mina', 'pall'))).toEqual([])
  })
})

describe('the speech cache', () => {
  const board = (titles: string[], extra?: { grammar?: boolean }) =>
    ({ compounds: [], extra, grid: { cells: titles.map((title) => ({ title })) } }) as never

  it('keeps the forms after the cards, without repeating a card', () => {
    expect(collectBoardTTSInputs(board(['mina', 'ei', 'tahtma', 'tahan']))).toEqual([
      { source: 'cell', text: 'mina.' },
      { source: 'cell', text: 'ei.' },
      { source: 'cell', text: 'tahtma.' },
      { source: 'cell', text: 'tahan.' },
      { source: 'grammar', text: 'taha.' },
      { source: 'grammar', text: 'tahta.' },
    ])
  })

  it('keeps no forms when the word forms are off', () => {
    expect(collectBoardTTSInputs(board(['mina', 'jooksma'], { grammar: false })).map((input) => input.source)).toEqual([
      'cell',
      'cell',
    ])
  })

  it('keeps at most GRAMMAR_SPEECH_MAX forms', () => {
    const verbs = Object.keys(VERB_FORMS).slice(0, 40)
    const inputs = collectBoardTTSInputs(board(['mina', 'sina', 'tema', 'ei', 'ja', ...verbs]))
    expect(inputs.filter((input) => input.source === 'grammar')).toHaveLength(GRAMMAR_SPEECH_MAX)
  })
})
