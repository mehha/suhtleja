import { guessWordClass, isPronoun, normalizeWord } from '@/utilities/wordClass'
import { IRREGULAR_PRESENT, VERB_FORMS } from './verbForms'

// The board's word forms (docs/rules/project/boards.md, "Word forms"): a verb card in the
// ma-infinitive takes the form the sentence gives it. "mina" + "jooksma" says "mina jooksen",
// "ei" + "jooksma" "ei jookse", "tahan" + "sööma" "tahan süüa". Pure, so the runner, the editor's
// hint, the speech cache and the tests share it. Tested in tests/int/grammar.int.spec.ts.

export type Person = '1sg' | '2sg' | '3sg' | '1pl' | '2pl' | '3pl'
export type VerbFormKind = Person | 'neg' | 'da'

export type GrammarToken = {
  text: string
  wordClass?: string | null
}

const ENDINGS: Record<Person, 'n' | 'd' | 'b' | 'me' | 'te' | 'vad'> = {
  '1sg': 'n',
  '2sg': 'd',
  '3sg': 'b',
  '1pl': 'me',
  '2pl': 'te',
  '3pl': 'vad',
}

// Subjects in the nominative.
const SUBJECT_PRONOUNS: Record<string, Person> = {
  mina: '1sg',
  ma: '1sg',
  sina: '2sg',
  sa: '2sg',
  tema: '3sg',
  ta: '3sg',
  meie: '1pl',
  me: '1pl',
  teie: '2pl',
  te: '2pl',
  nemad: '3pl',
  nad: '3pl',
}

// Words that are a subject when no pronoun is: "see on", "kes tuleb".
const OTHER_SUBJECTS: Record<string, Person> = {
  see: '3sg',
  too: '3sg',
  keegi: '3sg',
  kes: '3sg',
  need: '3pl',
}

// People, for cards without a word class (boards from before word classes): the picture bank's
// Inimesed and other people children talk about. A card the parent classed decides by its class.
const PEOPLE = new Set(
  [
    'ema isa emme issi memm taat vanaema vanaisa õde vend tädi onu nõbu sõber sõbranna perekond',
    'beebi laps poiss tüdruk mees naine inimene',
    'õpetaja kasvataja logopeed eripedagoog tugiisik arst hambaarst loomaarst juuksur müüja',
    'bussijuht autojuht politsei politseinik kokk treener naaber külaline päkapikk jõuluvana',
  ]
    .join(' ')
    .split(' '),
)
const PEOPLE_PLURAL = new Set('lapsed sõbrad vanemad vanavanemad inimesed poisid tüdrukud õed vennad'.split(' '))

// "mul on", "mulle meeldib": with one of these and no subject, the verb is in the 3rd person singular.
const EXPERIENCERS = new Set(
  'mul minul sul sinul tal temal meil teil neil mulle minule sulle sinule talle temale meile teile neile'.split(' '),
)

// After these, another verb is in the da-infinitive (tahan süüa). After any other verb it stays as
// the card says (pean minema, lähen sööma).
export const DA_VERBS = new Set([
  'armastama',
  'julgema',
  'kartma',
  'lubama',
  'meeldima',
  'oskama',
  'otsustama',
  'proovima',
  'saama',
  'soovima',
  'suutma',
  'tahtma',
  'tohtima',
  'unustama',
  'viitsima',
  'võima',
])

// "ja" joins subjects ("mina ja ema lähme") or, after a verb, starts a clause that keeps the
// subject ("mina söön ja joon"). These start a clause that keeps it too.
const JOINING = new Set(['ja', 'ning'])
const KEEPS_SUBJECT = new Set(['aga', 'või', 'ega'])
// These start a clause of its own.
const NEW_CLAUSE = new Set(['sest', 'et', 'kui', 'siis', 'kuna', 'kuigi', 'kuni'])

type VerbCard = {
  verb: string
  // The words before the verb ("hambaid" of "hambaid pesema"), which a finite verb goes before.
  rest: string
}

// A verb card the board conjugates: its text ends in a ma-infinitive the word list knows, and it is
// not classed as anything but a verb.
export function verbCard(text: string, wordClass?: string | null): VerbCard | null {
  const cardClass = wordClass ?? guessWordClass(text)
  if (cardClass && cardClass !== 'verb') return null

  const words = normalizeWord(text).split(' ')
  const verb = words.at(-1) ?? ''
  if (!VERB_FORMS[verb]) return null
  return { verb, rest: words.slice(0, -1).join(' ') }
}

function finiteWord(verb: string, kind: Person | 'neg'): string {
  const [stem] = VERB_FORMS[verb]!
  if (kind === 'neg') return stem
  const ending = ENDINGS[kind]
  return IRREGULAR_PRESENT[verb]?.[ending as Exclude<typeof ending, 'n'>] ?? stem + ending
}

/** The card's words in one form: the finite verb goes first ("pesen hambaid"), an infinitive last. */
export function verbForm({ verb, rest }: VerbCard, kind: VerbFormKind): string {
  if (kind === 'da') {
    const da = VERB_FORMS[verb]![1]
    return rest ? `${rest} ${da}` : da
  }
  const word = finiteWord(verb, kind)
  return rest ? `${word} ${rest}` : word
}

// A card that already is a verb form ("tahan", "süüa"): it isn't changed, but the next verb follows
// it. Bare stems are left out, since many are words of their own (tee, pea, too).
let knownForms: { finite: Map<string, string>; da: Map<string, string> } | null = null
function verbOfForm(text: string, wordClass?: string | null): { verb: string; finite: boolean } | null {
  const cardClass = wordClass ?? guessWordClass(text)
  if (cardClass && cardClass !== 'verb') return null

  if (!knownForms) {
    knownForms = { finite: new Map(), da: new Map() }
    for (const verb of Object.keys(VERB_FORMS)) {
      for (const person of Object.keys(ENDINGS) as Person[]) knownForms.finite.set(finiteWord(verb, person), verb)
      knownForms.da.set(VERB_FORMS[verb]![1], verb)
    }
  }
  const word = normalizeWord(text)
  const finite = knownForms.finite.get(word)
  if (finite) return { verb: finite, finite: true }
  const da = knownForms.da.get(word)
  return da ? { verb: da, finite: false } : null
}

type Subject = {
  person: Person
  // A pronoun outranks a person or "see": "mina ema kallistama" is "mina kallistan ema". A subject
  // kept from the clause before gives way to any new one.
  rank: 'pronoun' | 'other' | 'kept'
}

function subjectOf(text: string, wordClass?: string | null): Subject | null {
  const word = normalizeWord(text)
  const pronoun = SUBJECT_PRONOUNS[word]
  if (pronoun) return { person: pronoun, rank: 'pronoun' }
  const other = OTHER_SUBJECTS[word]
  if (other) return { person: other, rank: 'other' }
  if (isPronoun(word)) return null

  if (wordClass) {
    if (wordClass !== 'person') return null
    return { person: PEOPLE_PLURAL.has(word) ? '3pl' : '3sg', rank: 'other' }
  }
  if (PEOPLE.has(word)) return { person: '3sg', rank: 'other' }
  if (PEOPLE_PLURAL.has(word)) return { person: '3pl', rank: 'other' }
  return null
}

type Clause = {
  subjects: Subject[]
  // A "ja" since the last subject: the next one joins it.
  joining: boolean
  experiencer: boolean
  negated: boolean
  // The clause has its finite verb; later verbs are infinitives.
  finite: boolean
  // The last verb, which decides the next one's form.
  lastVerb: string | null
}

const newClause = (subjects: Subject[] = []): Clause => ({
  subjects,
  joining: false,
  experiencer: false,
  negated: false,
  finite: false,
  lastVerb: null,
})

// The person of the clause's subjects: "mina ja ema" are "meie", "sina ja ema" "teie".
function personOf(clause: Clause): Person | null {
  const { subjects } = clause
  if (subjects.length === 0) return clause.experiencer ? '3sg' : null
  if (subjects.length === 1) return subjects[0]!.person
  if (subjects.some((s) => s.person.startsWith('1'))) return '1pl'
  if (subjects.some((s) => s.person.startsWith('2'))) return '2pl'
  return '3pl'
}

function addSubject(clause: Clause, subject: Subject) {
  if (clause.joining) {
    clause.subjects.push(subject)
    clause.joining = false
    return
  }
  const own = clause.subjects.filter((s) => s.rank !== 'kept')
  if (own.length === 0) {
    clause.subjects = [subject]
    return
  }
  // Two subjects without "ja": the other one is the object ("mina ema kallistama").
  if (subject.rank === 'pronoun' && own.every((s) => s.rank === 'other')) clause.subjects = [subject]
}

// Keeps the card's capitals: "Jooksma" gives "Jooksen".
function withCase(original: string, form: string): string {
  const text = original.trim()
  if (text.length > 1 && text === text.toUpperCase() && text !== text.toLowerCase()) return form.toUpperCase()
  if (text[0] && text[0] !== text[0].toLowerCase()) return form[0]!.toUpperCase() + form.slice(1)
  return form
}

/**
 * The words of a sentence in the forms it gives them, one per token. Only verb cards in the
 * ma-infinitive change: after a subject or "ei" the first verb of a clause is finite, and a verb
 * after one of DA_VERBS takes the da-infinitive. Everything else stays as the card says.
 */
export function applyGrammar(tokens: GrammarToken[]): string[] {
  let clause = newClause()

  return tokens.map(({ text, wordClass }) => {
    const word = normalizeWord(text)

    if (NEW_CLAUSE.has(word)) {
      clause = newClause()
      return text
    }
    if (JOINING.has(word) || KEEPS_SUBJECT.has(word)) {
      if (clause.finite) {
        const person = personOf(clause)
        clause = newClause(person ? [{ person, rank: 'kept' }] : [])
      } else if (JOINING.has(word) && clause.subjects.length > 0) {
        clause.joining = true
      }
      return text
    }
    if (word === 'ei') {
      if (!clause.finite) clause.negated = true
      return text
    }

    const subject = subjectOf(text, wordClass)
    if (subject) {
      if (!clause.finite) addSubject(clause, subject)
      return text
    }
    if (EXPERIENCERS.has(word)) {
      if (!clause.finite) {
        clause.experiencer = true
        clause.subjects = clause.subjects.filter((s) => s.rank !== 'kept')
      }
      return text
    }

    const card = verbCard(text, wordClass)
    if (card) {
      if (clause.finite) {
        const form = clause.lastVerb && DA_VERBS.has(clause.lastVerb) ? verbForm(card, 'da') : null
        clause.lastVerb = card.verb
        return form ? withCase(text, form) : text
      }
      const kind = clause.negated ? 'neg' : personOf(clause)
      if (!kind) return text
      clause.finite = true
      clause.lastVerb = card.verb
      return withCase(text, verbForm(card, kind))
    }

    // A finite form is the clause's verb; an infinitive only continues a verb chain.
    const form = verbOfForm(text, wordClass)
    if (form && (form.finite || clause.finite)) {
      clause.finite = true
      clause.lastVerb = form.verb
    }
    return text
  })
}

const FORM_ORDER: VerbFormKind[] = ['1sg', '3sg', 'neg', 'da', '2sg', '1pl', '3pl', '2pl']
const PLURAL_OF: Partial<Record<Person, Person>> = { '1sg': '1pl', '2sg': '2pl', '3sg': '3pl' }

/**
 * The forms a board's verb cards can take in its sentences, most used first, for the speech cache:
 * the persons of the board's subject cards (and their plurals when it has "ja"), "ei" and the
 * da-infinitive when it has a card that calls for them.
 */
export function boardVerbForms(cards: GrammarToken[]): string[] {
  const kinds = new Set<VerbFormKind>()
  const verbs: Array<{ text: string; card: VerbCard }> = []
  let joining = false

  for (const { text, wordClass } of cards) {
    const word = normalizeWord(text)
    if (!word) continue
    if (JOINING.has(word)) joining = true
    if (word === 'ei') kinds.add('neg')
    if (EXPERIENCERS.has(word)) kinds.add('3sg')

    const subject = subjectOf(text, wordClass)
    if (subject) kinds.add(subject.person)

    const card = verbCard(text, wordClass)
    if (card) verbs.push({ text, card })
    const verb = card?.verb ?? verbOfForm(text, wordClass)?.verb
    if (verb && DA_VERBS.has(verb)) kinds.add('da')
  }
  if (joining) {
    for (const kind of [...kinds]) {
      const plural = PLURAL_OF[kind as Person]
      if (plural) kinds.add(plural)
    }
  }

  const forms = new Set<string>()
  for (const kind of FORM_ORDER) {
    if (!kinds.has(kind)) continue
    for (const { text, card } of verbs) forms.add(withCase(text, verbForm(card, kind)))
  }
  return [...forms]
}
