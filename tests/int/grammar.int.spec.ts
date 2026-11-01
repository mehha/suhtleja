// @vitest-environment node

// The board's word forms (src/utilities/grammar): real sentences a child taps, card by card, and
// the words the board says. Every rule has sentences that must stay as tapped, so a rule never
// reaches words it doesn't know (another AAC app said "jooksen staadionisse juustu").

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { applyCompounds } from '@/app/(frontend)/boards/[id]/compounds/applyCompounds'
import { collectBoardTTSInputs, GRAMMAR_SPEECH_MAX } from '@/utilities/boardTTSCache'
import { applyGrammar, boardWordForms, nounPartitive, placeFormsOf, verbCard, verbForm } from '@/utilities/grammar/applyGrammar'
import { VERB_FORMS } from '@/utilities/grammar/verbForms'
import { ADJECTIVE_PARTITIVE, NUMERAL_PARTITIVE, PLACE_FORMS } from '@/utilities/grammar/wordForms'

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
    // Objects in the partitive
    [['mina', 'tahtma', 'õun'], 'mina tahan õuna'],
    [['tahan', 'vesi'], 'tahan vett'],
    [['mina', 'ei', 'tahtma', 'piim'], 'mina ei taha piima'],
    [['mina', 'otsima', 'kass', 'ja', 'koer'], 'mina otsin kassi ja koera'],
    [['mina', 'otsima', 'sõber'], 'mina otsin sõpra'],
    [['mina', 'tahtma', 'sööma', 'õun'], 'mina tahan süüa õuna'],
    [['mul', 'ei', 'olema', 'pall'], 'mul ei ole palli'],
    [['mul', 'pole', 'pall'], 'mul pole palli'],
    [['mina', 'sööma', 'leib', 'ja', 'sina', 'jooma', 'piim'], 'mina söön leiba ja sina jood piima'],
    [['mina', 'sööma', 'leib', 'ja', 'jooma', 'vesi'], 'mina söön leiba ja joon vett'],
    [['mina', 'tahtma', 'või:noun'], 'mina tahan võid'],
    [['Mina', 'Tahtma', 'Õun'], 'Mina Tahan Õuna'],
    // Pronouns as objects
    [['tahan', 'see'], 'tahan seda'],
    [['tahan', 'see', 'pall'], 'tahan seda palli'],
    [['ema', 'kallistama', 'mina'], 'ema kallistab mind'],
    [['ema', 'kallistama', 'mina', 'ja', 'sina'], 'ema kallistab mind ja sind'],
    // Numerals
    [['kaks', 'kass'], 'kaks kassi'],
    [['mul', 'olema', 'kolm', 'auto'], 'mul on kolm autot'],
    [['tahan', 'kaks', 'õun'], 'tahan kahte õuna'],
    [['tahan', 'üks', 'õun'], 'tahan ühte õuna'],
    [['mina', 'vaatama', 'mitu', 'kass'], 'mina vaatan mitut kassi'],
    [['mina', 'tahtma', '2', 'õun'], 'mina tahan 2 õuna'],
    [['mul', 'ei', 'olema', 'kaks', 'kass'], 'mul ei ole kahte kassi'],
    // Adjectives take the noun's form
    [['tahan', 'suur', 'punane', 'pall'], 'tahan suurt punast palli'],
    [['tahan', 'kaks', 'suur', 'pall'], 'tahan kahte suurt palli'],
    [['kaks', 'väike', 'kass'], 'kaks väikest kassi'],
    // Nouns that keep their form
    [['mul', 'olema', 'pall'], 'mul on pall'],
    [['mina', 'olema', 'suur'], 'mina olen suur'],
    [['mina', 'tahtma', 'suur'], 'mina tahan suur'],
    [['mina', 'tahtma', 'natuke'], 'mina tahan natuke'],
    [['mina', 'tahtma', 'õun', 'või', 'banaan'], 'mina tahan õuna või banaani'],
    [['mina', 'ei', 'tahtma', 'õun', 'ega', 'banaan'], 'mina ei taha õuna ega banaani'],
    [['mina', 'tahtma', 'frisbi'], 'mina tahan frisbi'],
    [['ema', 'mina', 'kallistama'], 'ema mina kallistan'],
    [['see', 'ei', 'olema', 'pall'], 'see ei ole pall'],
    [['mina', 'ei', 'olema', 'kass'], 'mina ei ole kass'],
    // Places: where to after a verb of motion
    [['mina', 'minema', 'kool'], 'mina lähen kooli'],
    [['mina', 'minema', 'kodu'], 'mina lähen koju'],
    [['tema', 'tulema', 'kodu'], 'tema tuleb koju'],
    [['mina', 'jooksma', 'õu'], 'mina jooksen õue'],
    [['mina', 'minema', 'mänguväljak'], 'mina lähen mänguväljakule'],
    [['mina', 'tahtma', 'minema', 'park'], 'mina tahan minna parki'],
    [['mina', 'pidama', 'minema', 'pood'], 'mina pean minema poodi'],
    [['mina', 'ei', 'minema', 'lasteaed'], 'mina ei lähe lasteaeda'],
    [['mina', 'minema', 'kool', 'ja', 'pood'], 'mina lähen kooli ja poodi'],
    [['mina', 'minema', 'suur', 'park'], 'mina lähen suurde parki'],
    [['mina', 'minema', 'suur', 'mänguväljak'], 'mina lähen suurele mänguväljakule'],
    [['lähen', 'meri'], 'lähen merre'],
    // Where, after any other verb
    [['mina', 'olema', 'kodu'], 'mina olen kodus'],
    [['ema', 'olema', 'pood'], 'ema on poes'],
    [['mina', 'ei', 'olema', 'kodu'], 'mina ei ole kodus'],
    [['mina', 'mängima', 'õu'], 'mina mängin õues'],
    [['mina', 'sööma', 'kodu'], 'mina söön kodus'],
    [['mina', 'olema', 'mänguväljak'], 'mina olen mänguväljakul'],
    [['mina', 'olema', 'väike', 'maja'], 'mina olen väikeses majas'],
    // Where from
    [['mina', 'lahkuma', 'kool'], 'mina lahkun koolist'],
    // A place that is the object
    [['mina', 'otsima', 'haigla'], 'mina otsin haiglat'],
    // A place that keeps its form
    [['mul', 'olema', 'kodu'], 'mul on kodu'],
    [['see', 'olema', 'kool'], 'see on kool'],
    [['mul', 'ei', 'olema', 'haigla'], 'mul ei ole haiglat'],
    [['mina', 'minema', 'köök:noun'], 'mina lähen köök'],
    [['mina', 'minema', 'köök:place'], 'mina lähen kööki'],
    // With something (comitative): toys and people after "mängima"
    [['mina', 'mängima', 'auto'], 'mina mängin autoga'],
    [['mina', 'mängima', 'suur', 'auto'], 'mina mängin suure autoga'],
    [['mina', 'mängima', 'kaks', 'auto'], 'mina mängin kahe autoga'],
    [['mina', 'mängima', 'klotsid'], 'mina mängin klotsidega'],
    [['mina', 'mängima', 'ema'], 'mina mängin emaga'],
    [['mina', 'mängima', 'sina'], 'mina mängin sinuga'],
    [['mina', 'mängima', 'kass', 'ja', 'koer'], 'mina mängin kassiga ja koeraga'],
    [['mina', 'tahtma', 'mängima', 'nukk'], 'mina tahan mängida nukuga'],
    // but a game or an instrument is played, and a place is where
    [['mina', 'mängima', 'jalgpall'], 'mina mängin jalgpalli'],
    [['mina', 'mängima', 'kitarr'], 'mina mängin kitarri'],
    [['mina', 'mängima', 'õu'], 'mina mängin õues'],
    // Vehicles after a verb of motion
    [['mina', 'sõitma', 'buss'], 'mina sõidan bussiga'],
    [['mina', 'minema', 'kool', 'auto'], 'mina lähen kooli autoga'],
    [['mina', 'sõitma', 'kelk'], 'mina sõidan kelguga'],
    // Tools after what they are for
    [['mina', 'joonistama', 'pliiats'], 'mina joonistan pliiatsiga'],
    [['mina', 'joonistama', 'kass'], 'mina joonistan kassi'],
    [['mina', 'sööma', 'lusikas'], 'mina söön lusikaga'],
    [['mina', 'lõikama', 'käärid'], 'mina lõikan kääridega'],
    [['mina', 'tahtma', 'lusikas'], 'mina tahan lusikat'],
    // "koos"
    [['mina', 'minema', 'koos', 'ema'], 'mina lähen koos emaga'],
    [['mina', 'minema', 'ema', 'koos'], 'mina lähen emaga koos'],
    [['mina', 'minema', 'koos', 'suur', 'koer'], 'mina lähen koos suure koeraga'],
    [['koos', 'sina'], 'koos sinuga'],
    [['mina', 'ja', 'ema', 'koos', 'minema'], 'mina ja ema koos läheme'],
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
    // Without a verb or a counting numeral, a noun phrase keeps its form
    [['suur', 'pall']],
    [['üks', 'kass']],
    [['tahtma', 'õun']],
    [['pall', 'ja', 'auto']],
    // A place before the verb, or without one
    [['kool', 'minema']],
    [['mina', 'kool']],
    [['kaart', 'minema']],
  ])('%j stays as tapped', (cards) => {
    expect(say(...cards)).toBe(cards.map((card) => card.split(':')[0]).join(' '))
  })

  it('puts only the place in a case after a verb of motion: the thing after it keeps its form', () => {
    // Another AAC app said "jooksen staadionisse juustu".
    expect(say('mina', 'jooksma', 'staadion', 'juust')).toBe('mina jooksen staadionile juust')
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

  it("gives a noun card's partitive for the card dialog", () => {
    expect(nounPartitive('õun')).toBe('õuna')
    expect(nounPartitive('Sõber')).toBe('Sõpra')
    expect(nounPartitive('suur')).toBeNull()
    expect(nounPartitive('jooksma')).toBeNull()
    expect(nounPartitive('või')).toBeNull()
    expect(nounPartitive('või', 'noun')).toBe('võid')
  })

  it("gives a place card's forms for the card dialog", () => {
    expect(placeFormsOf('kodu')).toEqual({ to: 'koju', at: 'kodus' })
    expect(placeFormsOf('Mänguväljak')).toEqual({ to: 'Mänguväljakule', at: 'Mänguväljakul' })
    expect(placeFormsOf('köök', 'noun')).toBeNull()
    expect(placeFormsOf('kaart')).toBeNull()
  })

  it('has every place of the picture bank in the local cases', () => {
    const notPlaces = ['kaart', 'kraana', 'maakera']
    const bank = [
      ...readFileSync(path.resolve(__dirname, '../../scripts/pildipank/sonavara.csv'), 'utf8').split('\n'),
      ...readFileSync(path.resolve(__dirname, '../../scripts/pildipank/emoji.csv'), 'utf8').split('\n'),
    ]
      .map((line) => line.split(','))
      .filter((row) => row[0] === 'jah' && row[1] === 'Kohad' && !row[2]!.includes(' '))
      .map((row) => row[2]!.trim().toLowerCase())
    expect(bank.length).toBeGreaterThan(30)
    expect(bank.filter((word) => !notPlaces.includes(word) && !PLACE_FORMS[word])).toEqual([])
  })

  it('has the partitive of every noun, adjective and numeral of the picture bank', () => {
    const bank = readFileSync(path.resolve(__dirname, '../../scripts/pildipank/sonavara.csv'), 'utf8')
    const header = bank.split('\n')[0]!.split(',')
    const word = header.indexOf('sõna')
    const category = header.indexOf('kategooria')
    const rows = bank
      .split('\n')
      .slice(1)
      .map((line) => line.split(','))
    const of = (name: string) => rows.filter((row) => row[category] === name).map((row) => row[word]!.trim())
    // A sample of each kind; generate.py takes every word Vabamorf knows.
    expect(of('Toit').filter((text) => !text.includes(' ') && !nounPartitive(text, 'noun'))).toEqual([])
    expect(of('Inimesed').filter((text) => !text.includes(' ') && !/ma$/.test(text) && !nounPartitive(text, 'person'))).toEqual([])
    expect(
      of('Omadussõnad').filter(
        // Words that don't inflect before a noun, and "valju", which Vabamorf knows as "vali".
        (text) =>
          !['lahti', 'kinni', 'katki', 'palju', 'vähe', 'valmis', 'täis', 'valju'].includes(text) &&
          !ADJECTIVE_PARTITIVE[text],
      ),
    ).toEqual([])
    expect(['kaks', 'kolm', 'kümme', 'sada'].map((text) => NUMERAL_PARTITIVE[text])).toEqual(['kahte', 'kolme', 'kümmet', 'sadat'])
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
    expect(boardWordForms(cards('mina', 'tema', 'jooksma', 'pall'))).toEqual(['jooksen', 'jookseb'])
    expect(boardWordForms(cards('mina', 'ei', 'tahtma', 'sööma'))).toEqual(['tahan', 'söön', 'taha', 'söö', 'tahta', 'süüa', 'mind'])
  })

  it('has the plurals when the board has "ja"', () => {
    expect(boardWordForms(cards('mina', 'ema', 'ja', 'minema'))).toEqual(['lähen', 'läheb', 'läheme', 'lähevad'])
  })

  it('has the nouns and adjectives in the partitive with a verb that takes an object', () => {
    expect(boardWordForms(cards('mina', 'tahtma', 'suur', 'õun', 'kaks', 'see'))).toEqual([
      'tahan',
      'tahab',
      'tahta',
      'õuna',
      'suurt',
      'mind',
      'seda',
      'kahte',
    ])
  })

  it('has the nouns in the partitive with a counting numeral', () => {
    expect(boardWordForms(cards('kaks', 'kass', 'suur'))).toEqual(['kassi', 'suurt'])
  })

  it('has the places in the cases its verbs call for', () => {
    expect(boardWordForms(cards('mina', 'minema', 'olema', 'kool', 'kodu'))).toEqual([
      'lähen',
      'olen',
      'kooli',
      'koju',
      'koolis',
      'kodus',
    ])
  })

  it('has the forms with -ga a board calls for', () => {
    expect(boardWordForms(cards('mina', 'mängima', 'suur', 'auto', 'jalgpall'))).toEqual([
      'mängin',
      'autoga',
      'jalgpalli',
      'suure',
      'minuga',
    ])
    expect(boardWordForms(cards('mina', 'sõitma', 'buss', 'pall'))).toEqual(['sõidan', 'bussiga'])
    expect(boardWordForms(cards('koos', 'ema', 'sina'))).toEqual(['emaga', 'sinuga'])
  })

  it('has nothing without a subject, "ei" or a verb', () => {
    expect(boardWordForms(cards('jooksma', 'sööma'))).toEqual([])
    expect(boardWordForms(cards('mina', 'pall'))).toEqual([])
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
      { source: 'grammar', text: 'mind.' },
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
