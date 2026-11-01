import { guessWordClass, isPronoun, normalizeWord } from '@/utilities/wordClass'
import { IRREGULAR_PRESENT, VERB_FORMS } from './verbForms'
import {
  ADJECTIVE_PARTITIVE,
  ADJECTIVE_PLACE_FORMS,
  GENITIVE,
  MASS_NOUNS,
  NOUN_COMITATIVE,
  NOUN_PARTITIVE,
  NUMERAL_PARTITIVE,
  ON_PLACES,
  PLACE_FORMS,
  PLURAL_PARTITIVE,
  VEHICLES,
} from './wordForms'

// The board's word forms (docs/rules/project/boards.md, "Word form rules"): a verb card in the
// ma-infinitive takes the form the sentence gives it, and so do the nouns after it. "mina" +
// "jooksma" says "mina jooksen", "ei" + "jooksma" "ei jookse", "tahan" + "sööma" "tahan süüa",
// "tahan" + "suur" + "õun" "tahan suurt õuna", "kaks" + "kass" "kaks kassi", "lähen" + "kool"
// "lähen kooli", "olen" + "kodu" "olen kodus", "mängin" + "auto" "mängin autoga". Pure, so the runner,
// the editor's hint, the speech cache and the tests share it. Tested in tests/int/grammar.int.spec.ts.

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

// Verbs whose object is in the partitive: "tahan õuna", "otsin kassi". In the present tense the
// partitive is always right ("ostan jäätise", the whole of it, is left out). After any other verb a
// noun keeps its form ("olen kass"), and after "ei" it is in the partitive whatever the verb ("mul ei
// ole palli"). mängima is left out: its toys take "-ga" ("mängin autoga").
export const OBJECT_VERBS = new Set([
  'aitama', 'alustama', 'andestama', 'andma', 'armastama', 'avama', 'ehitama', 'ehmatama',
  'eelistama', 'harjutama', 'igatsema', 'imema', 'jagama', 'joonistama', 'jooma', 'jätkama',
  'kaevama', 'kallama', 'kallistama', 'kammima', 'kandma', 'kaotama', 'kartma', 'katsetama',
  'katsuma', 'keerama', 'keetma', 'kiitma', 'kinkima', 'kinnitama', 'kirjutama', 'kleepima',
  'koguma', 'koorima', 'korjama', 'koristama', 'kraapima', 'kuivatama', 'kustutama', 'kutsuma',
  'kuulama', 'kuulma', 'külastama', 'küpsetama', 'küsima', 'leidma', 'loendama', 'lugema',
  'lõhkuma', 'lõikama', 'lõpetama', 'lükkama', 'lööma', 'maitsma', 'meisterdama', 'murdma',
  'mõistma', 'mõõtma', 'mäletama', 'neelama', 'nuusutama', 'nägema', 'näitama', 'närima',
  'ootama', 'oskama', 'ostma', 'otsima', 'paitama', 'panema', 'parandama', 'peitma', 'pesema',
  'pigistama', 'pildistama', 'proovima', 'puhastama', 'puudutama', 'püüdma', 'raputama', 'rebima',
  'saama', 'segama', 'siduma', 'silitama', 'soovima', 'sorteerima', 'suudlema', 'sööma',
  'tahtma', 'teadma', 'tegema', 'tervitama', 'tooma', 'tundma', 'tõmbama', 'tõstma', 'tänama',
  'unustama', 'uskuma', 'uurima', 'vaatama', 'vahetama', 'vajama', 'vajutama', 'valama', 'valima',
  'venitama', 'vihkama', 'viima', 'viskama', 'voltima', 'voolima', 'võitma', 'võtma', 'värvima',
  'õpetama', 'õppima',
])

// After these a place is where to ("lähen kooli", "jooksen õue"); after "lahkuma" where from ("lahkun
// kodust"); after any other verb where ("olen kodus", "mängin õues", "söön köögis"). After the
// verbs in PLACE_OBJECT_VERBS the place is the object ("ehitan lossi", "otsin haiglat").
const MOTION_VERBS = new Set([
  'astuma', 'jooksma', 'jõudma', 'kiirustama', 'kukkuma', 'kõndima', 'lendama', 'libisema',
  'minema', 'panema', 'peituma', 'pugema', 'põgenema', 'roomama', 'ronima', 'saabuma',
  'sukelduma', 'sõitma', 'tooma', 'tulema', 'veerema', 'viima',
])
const SOURCE_VERBS = new Set(['lahkuma'])
const PLACE_OBJECT_VERBS = new Set([
  'ehitama', 'joonistama', 'kaotama', 'leidma', 'meisterdama', 'otsima', 'pildistama', 'värvima',
])

// What a noun is "with" (the comitative, -ga): after "mängima" anything but a game or an instrument
// ("mängin autoga", "mängin emaga"; but "mängin jalgpalli", "mängin kitarri", in the partitive); a
// vehicle after a verb of motion ("sõidan bussiga", "lähen autoga"); a tool after what it is for
// ("joonistan pliiatsiga", "söön lusikaga"); and whatever comes with "koos" ("koos emaga").
const PLAYED = new Set([
  'arvutimäng', 'flööt', 'hoki', 'jalgpall', 'kabe', 'kaardimäng', 'keegel', 'kitarr', 'klaver',
  'korvpall', 'kull', 'lauamäng', 'lauatennis', 'male', 'mäng', 'peitus', 'sulgpall', 'tennis',
  'trompet', 'trumm', 'viiul', 'võrkpall',
])
const TOOL_VERBS = new Set([
  'avama', 'ehitama', 'joonistama', 'jooma', 'kaevama', 'kammima', 'keerama', 'kirjutama', 'kleepima',
  'kustutama', 'lõikama', 'lööma', 'meisterdama', 'mõõtma', 'parandama', 'pesema', 'sööma', 'värvima',
])
const TOOLS = new Set([
  'haamer', 'hambahari', 'joonlaud', 'juuksehari', 'kahvel', 'kamm', 'kriit', 'kruvikeeraja',
  'kustukumm', 'käärid', 'kõrs', 'labidas', 'liim', 'lusikas', 'nuga', 'pastakas', 'pintsel',
  'pliiats', 'saag', 'teritaja', 'vahakriit', 'vildikas', 'võti', 'värvipliiats',
])
const COMITATIVE_PRONOUNS: Record<string, string> = {
  mina: 'minuga',
  ma: 'minuga',
  sina: 'sinuga',
  sa: 'sinuga',
  tema: 'temaga',
  ta: 'temaga',
  meie: 'meiega',
  me: 'meiega',
  teie: 'teiega',
  te: 'teiega',
  nemad: 'nendega',
  nad: 'nendega',
  see: 'sellega',
  too: 'tollega',
  need: 'nendega',
  keegi: 'kellegagi',
}

// Pronouns as objects: "ema kallistab mind", "tahan seda".
const OBJECT_PRONOUNS: Record<string, string> = {
  mina: 'mind',
  ma: 'mind',
  sina: 'sind',
  sa: 'sind',
  tema: 'teda',
  ta: 'teda',
  meie: 'meid',
  me: 'meid',
  teie: 'teid',
  te: 'teid',
  nemad: 'neid',
  nad: 'neid',
  see: 'seda',
  too: 'toda',
  need: 'neid',
  keegi: 'kedagi',
}

// Words like numerals: a noun after them is in the partitive singular ("mitu kassi", "natuke piima").
const QUANTIFIERS: Record<string, string> = { mitu: 'mitut', natuke: 'natuke' }
// After these a noun is in the partitive plural ("palju kasse", "palju suuri õunu"), or singular for
// a substance (MASS_NOUNS: "palju vett"). They keep their own form.
const PLURAL_QUANTIFIERS = new Set(['palju', 'vähe', 'rohkem', 'vähem'])
// Numerals after which the noun keeps its form ("üks kass").
const NOT_COUNTING = new Set(['üks', 'null'])

// "ja" joins subjects ("mina ja ema lähme") or, after a verb, starts a clause that keeps the
// subject ("mina söön ja joon"). These start a clause that keeps it too.
const JOINING = new Set(['ja', 'ning'])
const KEEPS_SUBJECT = new Set(['aga', 'või', 'ega'])
// These start a clause of its own.
const NEW_CLAUSE = new Set(['sest', 'et', 'kui', 'siis', 'kuna', 'kuigi', 'kuni'])
// After an object, these join another object to it: "õuna ja banaani", "õuna või banaani", "ei
// taha õuna ega banaani".
const JOINS_OBJECTS = new Set(['ja', 'ning', 'või', 'ega'])

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

// A word of a noun phrase: a noun, or an adjective or numeral that takes the form of the noun after
// it. Its class (a parent's pick, or the picture bank's category) says which list comes first;
// a word in only one list is what the list says ("ring" is a noun though shapes are filed with the
// colours).
type PhraseWord = {
  kind: 'noun' | 'adjective' | 'numeral'
  partitive: string
  // A numeral after which the noun is in the partitive ("kaks kassi", not "üks kass").
  counts: boolean
  // "palju": the noun after it is in the plural ("palju kasse").
  plural?: boolean
}

const NEVER_INFLECTED_CLASSES = new Set(['verb', 'question', 'social'])

// Words that are a noun only rarely ("või" is also butter, "kaasa" a spouse, "liiga" a league): they
// keep their form unless the card is classed as a noun or an adjective.
const FUNCTION_WORDS = new Set(
  'ei pole kas ka veel väga ainult liiga koos kaasa enne pärast siin seal nüüd kõik miks anna tere stopp hurraa palun aitäh jah'.split(
    ' ',
  ),
)

function phraseWord(text: string, wordClass?: string | null): PhraseWord | null {
  const cardClass = wordClass ?? guessWordClass(text)
  if (cardClass && NEVER_INFLECTED_CLASSES.has(cardClass)) return null
  const word = normalizeWord(text)
  if (PLURAL_QUANTIFIERS.has(word)) return { kind: 'numeral', partitive: word, counts: true, plural: true }
  if (QUANTIFIERS[word]) return { kind: 'numeral', partitive: QUANTIFIERS[word], counts: true }
  // Pronouns have their own forms (OBJECT_PRONOUNS); Vabamorf also knows "mulle" and "meil" as nouns.
  if (isPronoun(word) || EXPERIENCERS.has(word) || OBJECT_PRONOUNS[word]) return null
  const functionWord = FUNCTION_WORDS.has(word) || JOINING.has(word) || KEEPS_SUBJECT.has(word) || NEW_CLAUSE.has(word)
  if (functionWord && cardClass !== 'noun' && cardClass !== 'adjective') return null
  if (/^\d+$/.test(word)) return { kind: 'numeral', partitive: word, counts: Number(word) >= 2 }
  if (word.includes(' ')) return null

  const numeral = NUMERAL_PARTITIVE[word] ?? QUANTIFIERS[word]
  const asNumeral = numeral ? { kind: 'numeral' as const, partitive: numeral, counts: !NOT_COUNTING.has(word) } : null
  const noun = NOUN_PARTITIVE[word] ? { kind: 'noun' as const, partitive: NOUN_PARTITIVE[word], counts: false } : null
  const adjective = ADJECTIVE_PARTITIVE[word]
    ? { kind: 'adjective' as const, partitive: ADJECTIVE_PARTITIVE[word], counts: false }
    : null

  if (cardClass === 'adjective') return adjective ?? noun ?? asNumeral
  if (cardClass === 'noun' || cardClass === 'person' || cardClass === 'place') return noun ?? adjective ?? asNumeral
  return asNumeral ?? noun ?? adjective
}

// A place card's local cases (kooli, koolis, koolist): a card classed as a place, or without a class
// one the list of places has. A card classed as a thing is not a place ("voodi", "köök" from the
// picture bank's Kodu).
function placeForms(text: string, wordClass?: string | null) {
  const cardClass = wordClass ?? guessWordClass(text)
  if (cardClass && cardClass !== 'place') return null
  const word = normalizeWord(text)
  const forms = PLACE_FORMS[word]
  return forms ? { forms, on: ON_PLACES.has(word) } : null
}

/** A place card's forms where to and where ("kooli", "koolis"), for the card dialog; null for others. */
export function placeFormsOf(text: string, wordClass?: string | null): { to: string; at: string } | null {
  const place = placeForms(text, wordClass)
  return place ? { to: withCase(text, place.forms[0]), at: withCase(text, place.forms[1]) } : null
}

/** A noun card's partitive ("õuna"), for the card dialog; null for other cards. */
export function nounPartitive(text: string, wordClass?: string | null): string | null {
  const word = phraseWord(text, wordClass)
  return word?.kind === 'noun' ? withCase(text, word.partitive) : null
}

type Subject = {
  person: Person
  // A pronoun outranks a person or "see": "mina ema kallistama" is "mina kallistan ema". A subject
  // kept from the clause before gives way to any new one.
  rank: 'pronoun' | 'other' | 'kept'
  // "see", "too", "need": "see on kool" says what it is, not where.
  pointing?: boolean
}

function subjectOf(text: string, wordClass?: string | null): Subject | null {
  const word = normalizeWord(text)
  const pronoun = SUBJECT_PRONOUNS[word]
  if (pronoun) return { person: pronoun, rank: 'pronoun' }
  const other = OTHER_SUBJECTS[word]
  if (other) return { person: other, rank: 'other', pointing: ['see', 'too', 'need'].includes(word) }
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
  // The verb of an object or a place before a "ja": the words after it take their form from it too
  // ("otsin kassi ja koera", "lähen kooli ja poodi"), until a verb or a subject comes. After a
  // pronoun object, a pronoun is an object ("mind ja sind").
  carried: (Governor & { pronoun: boolean }) | null
}

// What decides a noun's form: the verb before it and the clause around it.
type Governor = {
  verb: string
  negated: boolean
  // "mul on": what one has is in the nominative ("mul on kodu"), and "mul ei ole" in the partitive.
  possessive: boolean
  // "olema" with a subject: "ma ei ole kass" keeps the noun, "ma olen kodus" puts a place where.
  copula: boolean
  // "see on kool": says what it is, not where.
  pointing: boolean
}

const newClause = (subjects: Subject[] = []): Clause => ({
  subjects,
  joining: false,
  experiencer: false,
  negated: false,
  finite: false,
  lastVerb: null,
  carried: null,
})

function governorOf(clause: Clause): Governor | null {
  if (clause.carried) return clause.carried
  if (!clause.finite || !clause.lastVerb) return null
  const olema = clause.lastVerb === 'olema'
  const own = clause.subjects.filter((s) => s.rank !== 'kept')
  return {
    verb: clause.lastVerb,
    negated: clause.negated,
    possessive: olema && clause.experiencer && own.length === 0,
    copula: olema && clause.subjects.length > 0 && !clause.experiencer,
    pointing: olema && own.some((s) => s.pointing),
  }
}

// A noun here is an object: after one of OBJECT_VERBS, or any verb after "ei" ("mul ei ole palli"),
// but not "olema" with a subject ("ma ei ole kass").
function takesObject(governor: Governor | null): boolean {
  if (!governor || governor.copula) return false
  return governor.negated || OBJECT_VERBS.has(governor.verb)
}

// The noun is what something is done with (-ga), from the verb before it.
function takesComitative(governor: Governor | null, word: string): boolean {
  if (!governor) return false
  if (governor.verb === 'mängima') return !PLAYED.has(word)
  if (MOTION_VERBS.has(governor.verb)) return VEHICLES.has(word)
  return TOOL_VERBS.has(governor.verb) && TOOLS.has(word)
}

// Where a place is: where to, where or where from (an index into PLACE_FORMS), 'object' when the
// place is the object, or null when it keeps its form ("mul on kodu", "see on kool").
function placeCase(governor: Governor | null): 0 | 1 | 2 | 'object' | null {
  if (!governor || governor.possessive || governor.pointing) return null
  if (MOTION_VERBS.has(governor.verb)) return 0
  if (SOURCE_VERBS.has(governor.verb)) return 2
  if (PLACE_OBJECT_VERBS.has(governor.verb)) return 'object'
  return 1
}

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
 * The words of a sentence in the forms it gives them, one per token. Verb cards in the
 * ma-infinitive: after a subject or "ei" the first verb of a clause is finite, and a verb after one
 * of DA_VERBS takes the da-infinitive. Nouns after the verb: an object is in the partitive, with
 * the adjectives and numerals before it, and a noun after a counting numeral is in the partitive
 * singular. Everything else stays as the card says.
 */
export function applyGrammar(tokens: GrammarToken[]): string[] {
  const out = tokens.map(({ text }) => text)
  let clause = newClause()
  // Adjectives and numerals waiting for their noun, which decides their form. Without a noun after
  // them they stay as tapped.
  let phrase: Array<{ index: number; word: PhraseWord }> = []
  // The object just said, for a "ja" after it.
  let lastObject: 'noun' | 'pronoun' | null = null
  // A "koos" before: the next noun or pronoun is in the comitative ("koos emaga").
  let withNext = false
  // The noun or pronoun just said after the verb, for a "koos" after it ("lähen emaga koos").
  type Said = { index: number; phrase: Array<{ index: number; word: PhraseWord }>; pronoun: string | null }
  let lastSaid: Said | null = null

  // A noun (or pronoun) in the comitative, its adjectives and numerals in the genitive: "suure
  // autoga", "kahe autoga", "minuga". A noun without a comitative stays as it is.
  const comitative = ({ index, phrase: words, pronoun }: Said) => {
    const form = pronoun ?? NOUN_COMITATIVE[normalizeWord(tokens[index]!.text)]
    if (!form) return
    out[index] = withCase(tokens[index]!.text, form)
    for (const { index: at } of words) {
      const genitive = GENITIVE[normalizeWord(tokens[at]!.text)]
      if (genitive) out[at] = withCase(tokens[at]!.text, genitive)
    }
  }

  const nounPhrase = (index: number, noun: PhraseWord) => {
    const governor = governorOf(clause)
    const word = normalizeWord(tokens[index]!.text)
    const place = placeForms(tokens[index]!.text, tokens[index]!.wordClass)
    const said: Said = { index, phrase, pronoun: null }
    // "palju" makes the phrase a partitive (below), whatever the verb: "mul on palju autosid".
    const many = phrase.some(({ word: before }) => before.plural)
    if (!many && (withNext || (!place && takesComitative(governor, word)))) {
      comitative(said)
      withNext = false
      phrase = []
      lastObject = 'noun'
      return
    }
    if (governor) lastSaid = said

    const where = place && !many ? placeCase(governor) : null
    if (place && typeof where === 'number') {
      // The adjectives before it take the place's case ("lähen suurde parki"); numerals stay.
      for (const { index: at, word } of phrase) {
        const forms = word.kind === 'adjective' ? ADJECTIVE_PLACE_FORMS[normalizeWord(tokens[at]!.text)] : null
        if (forms) out[at] = withCase(tokens[at]!.text, forms[(place.on ? 3 : 0) + where]!)
      }
      out[index] = withCase(tokens[index]!.text, place.forms[where])
      phrase = []
      lastObject = 'noun'
      return
    }

    // "mängin jalgpalli", "mängin kitarri": a game or an instrument is what is played.
    const object = takesObject(governor) || (governor?.verb === 'mängima' && PLAYED.has(word))
    const counted = phrase.some(({ word }) => word.counts)
    if (object || counted) {
      // After "palju" the plural, but a substance stays singular ("palju kasse", "palju vett").
      const plural = many && !MASS_NOUNS.has(word)
      const partitive = (text: string, of: PhraseWord) =>
        (plural && PLURAL_PARTITIVE[normalizeWord(text)]) || of.partitive
      for (const { index: at, word: before } of phrase) {
        // A numeral is in the partitive only as part of an object ("tahan kahte õuna", "mul on kaks õuna").
        if (before.kind === 'numeral' && !object) continue
        out[at] = withCase(tokens[at]!.text, partitive(tokens[at]!.text, before))
      }
      out[index] = withCase(tokens[index]!.text, partitive(tokens[index]!.text, noun))
    }
    phrase = []
    lastObject = object ? 'noun' : null
  }
  // The governor of the noun just said, carried over a "ja" after it.
  const carry = (pronoun: boolean) => {
    const governor = governorOf(clause)
    return governor ? { ...governor, pronoun } : null
  }

  tokens.forEach(({ text, wordClass }, index) => {
    const word = normalizeWord(text)
    const objectBefore = lastObject
    lastObject = null
    const saidBefore = lastSaid
    lastSaid = null

    const inPhrase = phraseWord(text, wordClass)
    if (inPhrase && inPhrase.kind !== 'noun' && !subjectOf(text, wordClass)) {
      phrase.push({ index, word: inPhrase })
      return
    }
    if (inPhrase?.kind === 'noun' && !subjectOf(text, wordClass)) {
      nounPhrase(index, inPhrase)
      return
    }
    // The noun phrase ends without a noun: its words stay as tapped.
    const phraseBefore = phrase
    phrase = []

    if (NEW_CLAUSE.has(word)) {
      clause = newClause()
      withNext = false
      return
    }
    // "koos": the noun or pronoun just said after the verb takes the comitative ("lähen emaga
    // koos"), or else the next one does ("koos emaga"). After subjects it is "together" ("mina ja
    // ema koos").
    if (word === 'koos') {
      if (saidBefore) comitative(saidBefore)
      else withNext = true
      return
    }
    if (JOINING.has(word) || KEEPS_SUBJECT.has(word)) {
      if (clause.finite || clause.carried) {
        const person = personOf(clause)
        const carried = objectBefore && JOINS_OBJECTS.has(word) ? carry(objectBefore === 'pronoun') : null
        clause = newClause(person ? [{ person, rank: 'kept' }] : [])
        clause.carried = carried
      } else if (JOINING.has(word) && clause.subjects.length > 0) {
        clause.joining = true
      }
      return
    }
    if (word === 'ei') {
      if (!clause.finite) clause.negated = true
      return
    }
    // "pole" is "ei ole".
    if (word === 'pole') {
      clause.carried = null
      clause.negated = true
      clause.finite = true
      clause.lastVerb = 'olema'
      return
    }

    const subject = subjectOf(text, wordClass)
    if (subject) {
      // With someone: "koos emaga", "koos sinuga", "mängin sõbraga".
      if (withNext || (clause.finite && governorOf(clause)?.verb === 'mängima')) {
        const pronoun = COMITATIVE_PRONOUNS[word]
        const person = phraseWord(text, wordClass)
        if (pronoun) {
          comitative({ index, phrase: phraseBefore, pronoun })
          withNext = false
          lastObject = 'pronoun'
          return
        }
        if (person?.kind === 'noun') {
          phrase = phraseBefore
          nounPhrase(index, person)
          return
        }
      }
      const objectPronoun = OBJECT_PRONOUNS[word]
      const asObject =
        clause.finite || clause.carried
          ? takesObject(governorOf(clause)) && (clause.finite || clause.carried?.pronoun || !objectPronoun)
          : false
      if (asObject) {
        // A person ("otsin sõpra") is a noun of the phrase; a pronoun takes its object form.
        const person = phraseWord(text, wordClass)
        if (!objectPronoun && person?.kind === 'noun') {
          phrase = phraseBefore
          nounPhrase(index, person)
          return
        }
        if (objectPronoun) {
          for (const { index: at, word: before } of phraseBefore) out[at] = withCase(tokens[at]!.text, before.partitive)
          out[index] = withCase(text, objectPronoun)
          lastObject = 'pronoun'
        }
        return
      }
      if (clause.carried) clause.carried = null
      if (!clause.finite) addSubject(clause, subject)
      // After the verb, a person or pronoun a "koos" can follow ("lähen emaga koos").
      else lastSaid = { index, phrase: phraseBefore, pronoun: COMITATIVE_PRONOUNS[word] ?? null }
      return
    }
    if (EXPERIENCERS.has(word)) {
      if (!clause.finite) {
        clause.experiencer = true
        clause.subjects = clause.subjects.filter((s) => s.rank !== 'kept')
      }
      return
    }

    const card = verbCard(text, wordClass)
    if (card) {
      clause.carried = null
      withNext = false
      if (clause.finite) {
        const form = clause.lastVerb && DA_VERBS.has(clause.lastVerb) ? verbForm(card, 'da') : null
        clause.lastVerb = card.verb
        if (form) out[index] = withCase(text, form)
        return
      }
      const kind = clause.negated ? 'neg' : personOf(clause)
      if (!kind) return
      clause.finite = true
      clause.lastVerb = card.verb
      out[index] = withCase(text, verbForm(card, kind))
      return
    }

    // A finite form is the clause's verb; an infinitive only continues a verb chain.
    const form = verbOfForm(text, wordClass)
    if (form && (form.finite || clause.finite)) {
      clause.carried = null
      clause.finite = true
      clause.lastVerb = form.verb
    }
  })

  return out
}

const FIRST_FORMS: VerbFormKind[] = ['1sg', '3sg', 'neg', 'da']
const LATER_FORMS: VerbFormKind[] = ['2sg', '1pl', '3pl', '2pl']
const PLURAL_OF: Partial<Record<Person, Person>> = { '1sg': '1pl', '2sg': '2pl', '3sg': '3pl' }

/** A card whose word a sentence can change: a verb, a noun, adjective or numeral, or a pronoun. */
export function canChangeForm(text: string, wordClass?: string | null): boolean {
  return Boolean(verbCard(text, wordClass) || phraseWord(text, wordClass) || OBJECT_PRONOUNS[normalizeWord(text)])
}

/**
 * The forms a board's cards can take in its sentences, most used first, for the speech cache: its
 * verbs in the persons of its subject cards (and their plurals when it has "ja"), after "ei" and in
 * the da-infinitive when it has a card that calls for them; its nouns and adjectives in the
 * partitive when it has a verb that takes an object, "ei" or a counting numeral; its places where
 * to, where and where from as its verbs call for them; its nouns, pronouns and adjectives "with"
 * (-ga) after "mängima" or "koos", its vehicles after a verb of motion and its tools after what they
 * are for; its pronouns and numerals as objects.
 */
export function boardWordForms(cards: GrammarToken[]): string[] {
  const kinds = new Set<VerbFormKind>()
  const verbs: Array<{ text: string; card: VerbCard }> = []
  const phraseWords: Array<{ text: string; word: PhraseWord }> = []
  const pronouns: Array<{ text: string; object: string }> = []
  const places: Array<{ text: string; forms: readonly string[] }> = []
  const placeCases = new Set<number>()
  const verbsOnBoard = new Set<string>()
  let together = false
  let joining = false
  let objects = false
  let counting = false

  for (const { text, wordClass } of cards) {
    const word = normalizeWord(text)
    if (!word) continue
    if (JOINING.has(word)) joining = true
    if (word === 'ei') kinds.add('neg')
    if (word === 'pole') objects = true
    if (word === 'koos') together = true
    if (EXPERIENCERS.has(word)) kinds.add('3sg')

    const subject = subjectOf(text, wordClass)
    if (subject) kinds.add(subject.person)
    if (OBJECT_PRONOUNS[word]) pronouns.push({ text, object: OBJECT_PRONOUNS[word] })

    const card = verbCard(text, wordClass)
    if (card) verbs.push({ text, card })
    const verb = card?.verb ?? verbOfForm(text, wordClass)?.verb
    if (verb && DA_VERBS.has(verb)) kinds.add('da')
    if (verb && OBJECT_VERBS.has(verb)) objects = true
    if (verb) placeCases.add(MOTION_VERBS.has(verb) ? 0 : SOURCE_VERBS.has(verb) ? 2 : 1)
    if (verb) verbsOnBoard.add(verb)

    const place = placeForms(text, wordClass)
    if (place) places.push({ text, forms: place.forms })

    const inPhrase = phraseWord(text, wordClass)
    if (inPhrase) {
      phraseWords.push({ text, word: inPhrase })
      if (inPhrase.counts) counting = true
    }
  }
  if (joining) {
    for (const kind of [...kinds]) {
      const plural = PLURAL_OF[kind as Person]
      if (plural) kinds.add(plural)
    }
  }
  if (kinds.has('neg') && verbs.length > 0) objects = true

  const forms = new Set<string>()
  const addVerbForms = (order: VerbFormKind[]) => {
    for (const kind of order) {
      if (!kinds.has(kind)) continue
      for (const { text, card } of verbs) forms.add(withCase(text, verbForm(card, kind)))
    }
  }
  addVerbForms(FIRST_FORMS)
  if (objects || counting) {
    const hasNoun = phraseWords.some(({ word }) => word.kind === 'noun')
    for (const kind of ['noun', 'adjective'] as const) {
      if (kind === 'adjective' && !hasNoun) continue
      for (const { text, word } of phraseWords) if (word.kind === kind) forms.add(withCase(text, word.partitive))
    }
  }
  for (const where of [0, 1, 2]) {
    if (!placeCases.has(where)) continue
    for (const { text, forms: placeForm } of places) forms.add(withCase(text, placeForm[where]!))
  }

  // With something (-ga): what "mängima" or "koos" can take, vehicles and tools.
  const playing = verbsOnBoard.has('mängima')
  const moving = [...verbsOnBoard].some((verb) => MOTION_VERBS.has(verb))
  const making = [...verbsOnBoard].some((verb) => TOOL_VERBS.has(verb))
  const withForm = (text: string) => NOUN_COMITATIVE[normalizeWord(text)]
  let withNoun = false
  for (const { text, word } of phraseWords) {
    if (word.kind !== 'noun') continue
    const key = normalizeWord(text)
    const played = PLAYED.has(key)
    const taken =
      ((together || playing) && !played && !placeForms(text)) ||
      (moving && VEHICLES.has(key)) ||
      (making && TOOLS.has(key))
    if (taken && withForm(text)) {
      forms.add(withCase(text, withForm(text)!))
      withNoun = true
    }
    if (playing && played) forms.add(withCase(text, word.partitive))
  }
  if (withNoun) {
    for (const { text, word } of phraseWords) {
      const genitive = word.kind !== 'noun' ? GENITIVE[normalizeWord(text)] : undefined
      if (genitive) forms.add(withCase(text, genitive))
    }
  }
  // After "palju": things in the plural partitive (substances are in the singular above).
  if (phraseWords.some(({ word }) => word.plural)) {
    for (const { text, word } of phraseWords) {
      const key = normalizeWord(text)
      if (word.kind === 'numeral' || MASS_NOUNS.has(key) || !PLURAL_PARTITIVE[key]) continue
      forms.add(withCase(text, PLURAL_PARTITIVE[key]))
    }
  }
  if (together || playing) {
    for (const { text } of pronouns) {
      const pronoun = COMITATIVE_PRONOUNS[normalizeWord(text)]
      if (pronoun) forms.add(withCase(text, pronoun))
    }
  }
  if (objects) {
    for (const { text, object } of pronouns) forms.add(withCase(text, object))
    for (const { text, word } of phraseWords) if (word.kind === 'numeral') forms.add(withCase(text, word.partitive))
  }
  addVerbForms(LATER_FORMS)
  return [...forms]
}
