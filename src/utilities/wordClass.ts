// A board card's word class (sõnaliik) and its colour, after the modified Fitzgerald key that AAC
// boards use: people yellow, actions green, descriptions blue, things orange, social words pink,
// question words purple. Places get their own colour (brown), because the word-form rules planned
// for phrases need to tell a place from a thing ("staadionisse", not "juustu").
//
// The card editor suggests a class from the card's text: a few word lists and the ma-infinitive
// first, then the picture bank category of a bank picture with exactly that word
// (`guessWordClass`, `/next/word-class`). The parent can change it; the board shows the colour
// on the card's border while the board's `extra.wordClassColors` is on.

export const WORD_CLASSES = [
  'person',
  'verb',
  'adjective',
  'noun',
  'place',
  'question',
  'social',
  'other',
] as const

export type WordClass = (typeof WORD_CLASSES)[number]

type WordClassInfo = {
  /** Border colour on the board, the editor and the phrase bar. */
  color: string
  /** Shown next to the label in the card editor. */
  examples: string
  label: string
}

export const WORD_CLASS_INFO: Record<WordClass, WordClassInfo> = {
  person: { color: '#f2b705', examples: 'mina, ema', label: 'Inimene, asesõna' },
  verb: { color: '#2f9e57', examples: 'sööma, anna', label: 'Tegevus' },
  adjective: { color: '#1c79dd', examples: 'suur, rõõmus', label: 'Omadus' },
  noun: { color: '#ff980d', examples: 'pall, õun', label: 'Asi' },
  place: { color: '#9a6324', examples: 'kodu, pood', label: 'Koht' },
  question: { color: '#8b5cf6', examples: 'kes, kus', label: 'Küsisõna' },
  social: { color: '#e5489a', examples: 'tere, aitäh', label: 'Suhtlemine' },
  other: { color: '#8a94a6', examples: 'veel, ka', label: 'Muu sõna' },
}

export function isWordClass(value: unknown): value is WordClass {
  return typeof value === 'string' && (WORD_CLASSES as readonly string[]).includes(value)
}

/** The colour for a card's border, or null for a card without a class. */
export function wordClassColor(value: unknown): string | null {
  return isWordClass(value) ? WORD_CLASS_INFO[value].color : null
}

// Picture bank categories (CATEGORY_ORDER in scripts/pildipank/lib.ts) and the class their words
// mostly have. The word rules in guessWordClass come first, for the verbs and pronouns filed under
// other categories ("laulma" under Inimesed, "mina" under Suhtlemine).
const CATEGORY_CLASSES: Record<string, WordClass> = {
  Suhtlemine: 'social',
  Asesõnad: 'person',
  Küsisõnad: 'question',
  Põhisõnad: 'other',
  Tunded: 'adjective',
  Omadussõnad: 'adjective',
  Inimesed: 'person',
  Tegevused: 'verb',
  Keha: 'noun',
  Tervis: 'noun',
  Toit: 'noun',
  Puuviljad: 'noun',
  Köögiviljad: 'noun',
  Maiustused: 'noun',
  Joogid: 'noun',
  Köök: 'noun',
  Riided: 'noun',
  Kodu: 'noun',
  'Lasteaed ja kool': 'noun',
  Mänguasjad: 'noun',
  Sport: 'noun',
  Muusika: 'noun',
  'Pidu ja tähtpäevad': 'noun',
  Loomad: 'noun',
  Loodus: 'noun',
  Ilm: 'noun',
  Kohad: 'place',
  Transport: 'noun',
  Aeg: 'other',
  Numbrid: 'other',
  Tähed: 'other',
  'Värvid ja kujundid': 'adjective',
  Asjad: 'noun',
  Muinasjutud: 'noun',
}

export function pictureBankCategoryWordClass(category: string | null | undefined): WordClass | null {
  return (category && CATEGORY_CLASSES[category]) || null
}

/** The categories mapped above, for the test that keeps them in step with the picture bank. */
export const MAPPED_PICTURE_BANK_CATEGORIES = Object.keys(CATEGORY_CLASSES)

// Personal pronouns with the cases children use (the bank has mul, mulle, mind...).
const PRONOUNS = new Set(
  [
    'ma mina minu mind minul mul minule mulle minuga',
    'sa sina sinu sind sinul sul sinule sulle sinuga',
    'ta tema teda temal tal temale talle temaga',
    'me meie meid meil meile meiega',
    'te teie teid teil teile teiega',
    'nad nemad nende neid neil neile nendega',
  ]
    .join(' ')
    .split(' '),
)

const QUESTION_WORDS = new Set([
  ...'kes mis kus kuhu kust millal miks kuidas kelle kellele kellelt kellega mida mille milline missugune kumb'.split(
    ' ',
  ),
  'kui palju',
  'kui kaua',
])

const SOCIAL_WORDS = new Set([
  'tere',
  'tsau',
  'head aega',
  'nägemist',
  'aitäh',
  'tänan',
  'palun',
  'jah',
  'ei',
  'okei',
  'vabandust',
  'head ööd',
  'tere hommikust',
])

// Imperatives a board uses as their own cards; they don't end in -ma, and the bank files several
// of them under Suhtlemine.
const IMPERATIVES = new Set([
  'aita',
  'anna',
  'istu',
  'kuula',
  'lõpeta',
  'mine',
  'näita',
  'oota',
  'pane kinni',
  'tee lahti',
  'tule',
  'tule siia',
  'vaata',
  'ära puutu',
  'ära tee',
])

// Words ending in -ma that are not ma-infinitives.
const NOT_VERBS = new Set([
  'draama',
  'kliima',
  'laama',
  'panoraama',
  'pidžaama',
  'pidzaama',
  'skeema',
  'teema',
  'vanaema',
  'vanavanaema',
])

// A ma-infinitive (jooksma, sööma, mängima): one word, at least three letters before -ma, so
// "ema" and "tema" are not verbs.
const MA_INFINITIVE = /^[a-zäöüõšž]{3,}ma$/

export function normalizeWord(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * The class a card's text suggests. `category` is the picture bank category of a bank picture with
 * exactly this word, if there is one. Null when nothing is known: the card stays without a colour
 * until the parent picks one.
 */
export function guessWordClass(text: string, category?: string | null): WordClass | null {
  const word = normalizeWord(text)
  if (!word) return null

  if (PRONOUNS.has(word)) return 'person'
  if (QUESTION_WORDS.has(word)) return 'question'
  if (IMPERATIVES.has(word)) return 'verb'
  if (MA_INFINITIVE.test(word) && !NOT_VERBS.has(word)) return 'verb'

  const fromCategory = pictureBankCategoryWordClass(category)
  if (fromCategory) return fromCategory

  if (SOCIAL_WORDS.has(word)) return 'social'
  return null
}
