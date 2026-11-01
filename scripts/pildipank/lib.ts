import { createHash } from 'node:crypto'

// The picture bank import's pure parts: reading the reviewed word lists, deciding which media to
// create, and drawing text tiles and shapes. scripts/pildipank/import.ts does the Payload work;
// tests/int/picture-bank.int.spec.ts tests this file.

/** Fluent Emoji commit the pictures come from (fluentURL); the paths in emoji.csv are from this commit. */
export const FLUENT_SHA = '1ffb34c752ecf5d402f04cfb4b392c77f57c54bc'

export const FLUENT_CAPTION = 'Fluent Emoji © Microsoft Corporation, MIT'
export const MULBERRY_CAPTION = 'Mulberry Symbols © Steve Lee, CC BY-SA 4.0 (globalsymbols.com)'

/** The order categories are created in, which is the order the card editor shows them. */
export const CATEGORY_ORDER = [
  'Suhtlemine',
  'Asesõnad',
  'Küsisõnad',
  'Põhisõnad',
  'Tunded',
  'Omadussõnad',
  'Inimesed',
  'Tegevused',
  'Keha',
  'Tervis',
  'Toit',
  'Puuviljad',
  'Köögiviljad',
  'Maiustused',
  'Joogid',
  'Köök',
  'Riided',
  'Kodu',
  'Lasteaed ja kool',
  'Mänguasjad',
  'Sport',
  'Muusika',
  'Pidu ja tähtpäevad',
  'Loomad',
  'Loodus',
  'Ilm',
  'Kohad',
  'Transport',
  'Aeg',
  'Numbrid',
  'Tähed',
  'Värvid ja kujundid',
  'Asjad',
  'Muinasjutud',
]

// Each category's cover: imported first, so it is the folder's oldest picture.
export const CATEGORY_COVERS: Record<string, string> = {
  Suhtlemine: 'tere',
  Asesõnad: 'mina',
  Küsisõnad: 'küsimus',
  Tunded: 'rõõmus',
  Omadussõnad: 'hea',
  Inimesed: 'laps',
  Tegevused: 'jooksma',
  Keha: 'kõrv',
  Tervis: 'plaaster',
  Toit: 'pitsa',
  Puuviljad: 'õun',
  Köögiviljad: 'porgand',
  Maiustused: 'jäätis',
  Joogid: 'mahl',
  Köök: 'taldrik',
  Riided: 'särk',
  Kodu: 'voodi',
  'Lasteaed ja kool': 'seljakott',
  Mänguasjad: 'kaisukaru',
  Sport: 'jalgpall',
  Muusika: 'trumm',
  'Pidu ja tähtpäevad': 'õhupall',
  Loomad: 'koer',
  Loodus: 'puu',
  Ilm: 'päike',
  Kohad: 'maja',
  Transport: 'auto',
  Aeg: 'kell',
  Numbrid: 'üks',
  Tähed: 'A',
  'Värvid ja kujundid': 'punane',
  Asjad: 'võti',
  Muinasjutud: 'haldjas',
}

export type CsvRow = Record<string, string>

/** RFC 4180 CSV with a header row (quoted fields may hold commas, quotes and line breaks). */
export function parseCsv(text: string): CsvRow[] {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      record.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else field += char
  }
  if (field || record.length) {
    record.push(field)
    records.push(record)
  }

  const [header, ...rows] = records.filter((r) => r.some((value) => value !== ''))
  if (!header) return []
  return rows.map((values) => Object.fromEntries(header.map((name, i) => [name, values[i] ?? ''])))
}

const ASCII: Record<string, string> = { õ: 'o', ä: 'a', ö: 'o', ü: 'u', š: 's', ž: 'z' }

/** ASCII file name part for a word: "jõulukuusk" -> "joulukuusk", "head ööd" -> "head-ood". */
export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[õäöüšž]/g, (c) => ASCII[c])
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// File name part for a word. Transliteration can merge words ("kõrv" and "korv", "Š" and "S"), so a
// word that needed it gets a short hash of the original too.
export function fileWord(word: string): string {
  const ascii = slug(word)
  return ascii === word.toLowerCase().replace(/\s+/g, '-') ? ascii : `${ascii}-${createHash('sha1').update(word).digest('hex').slice(0, 6)}`
}

export type PictureSource =
  | { kind: 'fluent'; code: string; emoji: string; path: string }
  | { kind: 'mulberry'; url: string }
  | { kind: 'tekst'; text: string }
  | { kind: 'kujund'; spec: string }
  | { kind: 'ai'; file: string }

export type BankItem = {
  caption: string | null
  category: string
  /** Media file name without extension; stable across runs, so a rerun updates instead of adding. */
  key: string
  source: PictureSource
  word: string
}

const noVS = (value: string) => value.replace(/️/g, '')

/**
 * The media the picture bank needs, from the reviewed lists: every kept emoji, and every kept
 * vocabulary word with a picture (AI words wait until their pictures exist). A vocabulary word that
 * is also an emoji word files that emoji picture under the vocabulary's category instead of adding a
 * second picture. Items come in category order, each category's cover first.
 */
export function buildBankItems(
  emojiRows: CsvRow[],
  vocabularyRows: CsvRow[],
): { items: BankItem[]; waitingForAI: string[] } {
  const fluentByEmoji = new Map(emojiRows.map((row) => [noVS(row['emoji']), row]))
  const fluentItem = (row: CsvRow, word: string, category: string): BankItem => ({
    caption: FLUENT_CAPTION,
    category,
    key: `pildipank-${fileWord(word)}-${row['kood'].replace(/\s+/g, '-')}`,
    source: { kind: 'fluent', code: row['kood'], emoji: noVS(row['emoji']), path: row['fluent_pilt'] },
    word,
  })

  const items: BankItem[] = []
  const byWord = new Map<string, BankItem>()
  for (const row of emojiRows) {
    if (row['kaasa'] !== 'jah') continue
    const item = fluentItem(row, row['sõna'], row['kategooria'])
    items.push(item)
    byWord.set(item.word.toLowerCase(), item)
  }

  const waitingForAI: string[] = []
  for (const row of vocabularyRows) {
    if (row['kaasa'] !== 'jah') continue
    const word = row['sõna']
    const category = row['kategooria']
    const ref = row['viide']

    if (row['pilt'] === 'emoji') {
      const existing = byWord.get(word.toLowerCase())
      if (existing?.source.kind === 'fluent' && existing.source.emoji === noVS(ref)) {
        existing.category = category
        continue
      }
      const emojiRow = fluentByEmoji.get(noVS(ref))
      if (!emojiRow) throw new Error(`${word}: emoji ${ref} is not in emoji.csv`)
      items.push(fluentItem(emojiRow, word, category))
    } else if (row['pilt'] === 'mulberry') {
      items.push({ caption: MULBERRY_CAPTION, category, key: `pildipank-${fileWord(word)}-mulberry`, source: { kind: 'mulberry', url: ref }, word })
    } else if (row['pilt'] === 'tekst') {
      items.push({ caption: null, category, key: `pildipank-${fileWord(word)}-tekst`, source: { kind: 'tekst', text: ref || word }, word })
    } else if (row['pilt'] === 'kujund') {
      items.push({ caption: null, category, key: `pildipank-${fileWord(word)}-kujund`, source: { kind: 'kujund', spec: ref }, word })
    } else if (ref) {
      // An AI picture generate-ai.ts has made (scripts/pildipank/ai-pildid/<file>).
      // The file name is the media key: a redone picture gets a new name (-v2), so the import adds it
      // and the clean-up retires the old one.
      items.push({ caption: null, category, key: ref.replace(/\.[a-z0-9]+$/i, ''), source: { kind: 'ai', file: ref }, word })
    } else {
      waitingForAI.push(word)
    }
  }

  const keys = new Set<string>()
  for (const item of items) {
    if (keys.has(item.key)) throw new Error(`Two pictures would share the file name ${item.key}`)
    keys.add(item.key)
    if (!CATEGORY_ORDER.includes(item.category)) throw new Error(`${item.word}: unknown category ${item.category}`)
  }

  const rank = (item: BankItem) =>
    CATEGORY_ORDER.indexOf(item.category) * 2 + (CATEGORY_COVERS[item.category] === item.word ? 0 : 1)
  const ordered = items.map((item, i) => ({ item, i })).sort((a, b) => rank(a.item) - rank(b.item) || a.i - b.i)
  return { items: ordered.map(({ item }) => item), waitingForAI }
}

/** File name (without extension) of a word's AI picture: `-v<attempt>` once it has been redone. */
export function aiPictureKey(word: string, attempt = 0): string {
  return `pildipank-${fileWord(word)}-ai${attempt ? `-v${attempt}` : ''}`
}

/** Writes rows back as CSV with the given column order (the reviewed lists are edited by hand too). */
export function toCsv(rows: CsvRow[], columns: string[]): string {
  const cell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
  return [columns.join(','), ...rows.map((row) => columns.map((name) => cell(row[name] ?? '')).join(','))].join('\n') + '\n'
}

// Descriptions of several people need the group variant of the pictogram style.
export function describesGroup(description: string): boolean {
  return /\b(three|group|family|children|people|circle|everyone)\b/i.test(description)
}

/**
 * Bank pictures a list change has replaced: a stored bank file that is no longer expected, whose word
 * belongs to exactly one expected picture (a homonym like "või" is left alone). Copies that
 * findDuplicateFiles pairs are not repeated here.
 */
export function findReplacedFiles(
  expected: Map<string, string>,
  stored: Array<{ alt: string; name: string }>,
  alreadyPaired: Set<string> = new Set(),
): Array<{ duplicate: string; original: string }> {
  const present = new Set(stored.map(({ name }) => name))
  const byWord = new Map<string, string[]>()
  for (const [name, word] of expected) {
    if (present.has(name)) byWord.set(word, [...(byWord.get(word) ?? []), name])
  }
  return stored.flatMap(({ alt, name }) => {
    if (expected.has(name) || alreadyPaired.has(name) || !name.startsWith('pildipank-')) return []
    const candidates = byWord.get(alt) ?? []
    return candidates.length === 1 ? [{ duplicate: name, original: candidates[0] }] : []
  })
}

/**
 * Pictures stored twice. Payload gives a second file with an existing name a counter: `<name>-1.<ext>`,
 * or, when the name already ends in `-<digits>` (emoji codes like 2705), that number counted up
 * (`…-2706.png`). Returns each such copy with the expected name it copies, when that one exists with
 * the same alt text (the word).
 */
export function findDuplicateFiles(
  expected: Set<string>,
  stored: Array<{ alt: string; name: string }>,
): Array<{ duplicate: string; original: string }> {
  const altOf = new Map(stored.map(({ alt, name }) => [name, alt]))
  return stored.flatMap(({ alt, name }) => {
    if (expected.has(name)) return []
    const match = name.match(/^(.+)-(\d+)(\.[a-z0-9]+)$/i)
    if (!match) return []
    const [, stem, digits, ext] = match
    const candidates = [`${stem}${ext}`]
    for (let back = 1; back <= 9 && Number(digits) - back >= 0; back++) {
      candidates.push(`${stem}-${String(Number(digits) - back).padStart(digits.length, '0')}${ext}`)
    }
    const original = candidates.find((candidate) => expected.has(candidate) && altOf.get(candidate) === alt)
    return original ? [{ duplicate: name, original }] : []
  })
}

/** jsDelivr URL of a Fluent picture at the pinned commit. */
export function fluentURL(path: string): string {
  return `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@${FLUENT_SHA}/${path.split('/').map(encodeURIComponent).join('/')}`
}

const escapeXML = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${body}</svg>`

/** A text tile: big for a letter or number, smaller for a word. */
export function renderTextTile(text: string): string {
  const size = text.length <= 2 ? 120 : text.length <= 3 ? 90 : text.length <= 5 ? 58 : text.length <= 7 ? 44 : 34
  return svg(
    `<text x="100" y="104" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="700" fill="#1f2937" text-anchor="middle" dominant-baseline="middle">${escapeXML(text)}</text>`,
  )
}

const WEEKDAY_LETTERS = ['E', 'T', 'K', 'N', 'R', 'L', 'P']

/** A drawn shape: ring, ruut, kolmnurk, ristkülik, ovaal, romb, värv:#hex, nädal[:N or :N-M], lipp:ee. */
export function renderShape(spec: string): string {
  const shape = (inner: string) => svg(`<g fill="#fbbf24" stroke="#1f2937" stroke-width="8" stroke-linejoin="round">${inner}</g>`)
  const shapes: Record<string, string> = {
    kolmnurk: '<polygon points="100,28 176,168 24,168"/>',
    ovaal: '<ellipse cx="100" cy="100" rx="80" ry="52"/>',
    ring: '<circle cx="100" cy="100" r="72"/>',
    ristkülik: '<rect x="18" y="56" width="164" height="88"/>',
    romb: '<polygon points="100,20 176,100 100,180 24,100"/>',
    ruut: '<rect x="32" y="32" width="136" height="136"/>',
  }
  if (shapes[spec]) return shape(shapes[spec])

  const colour = spec.match(/^värv:(#[0-9a-fA-F]{3,8})$/)
  if (colour) return svg(`<circle cx="100" cy="100" r="76" fill="${colour[1]}" stroke="#1f2937" stroke-width="4"/>`)

  const week = spec.match(/^nädal(?::(\d)(?:-(\d))?)?$/)
  if (week) {
    const from = Number(week[1] ?? 0)
    const to = Number(week[2] ?? week[1] ?? 0)
    const cells = WEEKDAY_LETTERS.map((letter, i) => {
      const day = i + 1
      const on = from <= day && day <= to
      const x = 8 + i * 26.5
      return (
        `<rect x="${x}" y="64" width="22" height="48" rx="4" fill="${on ? '#2563eb' : '#e5e7eb'}" stroke="#1f2937" stroke-width="2"/>` +
        `<text x="${x + 11}" y="138" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#1f2937" text-anchor="middle">${letter}</text>`
      )
    })
    return svg(cells.join(''))
  }

  if (spec === 'lipp:ee') {
    return svg(
      '<rect x="20" y="50" width="160" height="34" fill="#0072ce"/><rect x="20" y="84" width="160" height="34" fill="#000"/>' +
        '<rect x="20" y="118" width="160" height="34" fill="#fff"/><rect x="20" y="50" width="160" height="102" fill="none" stroke="#1f2937" stroke-width="3"/>',
    )
  }

  throw new Error(`Unknown shape: ${spec}`)
}

/**
 * A third-party SVG made safe to serve from our own origin: scripts, event handlers, embedded
 * documents and links out of the file are removed. Returns null when it still looks unsafe.
 */
export function sanitizeSvg(input: string): string | null {
  const out = input
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*("[^"]*"|'[^']*')/gi, (attr, value: string) =>
      /^["']\s*#/.test(value) ? attr : '',
    )
    .replace(/url\(\s*(?!['"]?#)[^)]*\)/gi, 'none')
    .trim()

  if (!/^<svg[\s>]/i.test(out)) return null
  if (/<script|javascript:|<foreignObject|<iframe|<!ENTITY|@import/i.test(out)) return null
  return out
}

/** A minimal Lexical document with one paragraph, for the media caption. */
export function captionDocument(text: string) {
  return {
    root: {
      children: [
        {
          children: [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }],
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          textFormat: 0,
          type: 'paragraph',
          version: 1,
        },
      ],
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}
