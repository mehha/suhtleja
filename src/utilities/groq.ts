const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Groq retires models (qwen/qwen3-32b went away). Every use fails soft, so a retired model silently turns
// the features off: watch for `model_not_found` in the logs.
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b'

export type GroqMessage = {
  content: string
  role: 'system' | 'user'
}

type GroqChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  error?: { code?: unknown; message?: unknown; type?: unknown }
}

export class GroqRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GroqRequestError'
  }
}

export async function createGroqJsonCompletion({
  messages,
  reasoningEffort,
  temperature,
}: {
  messages: GroqMessage[]
  // gpt-oss models reason before they answer. A word form needs little: "low" answered test
  // sentences as well as the default, about a quarter faster (2026-11-01). Other models ignore it.
  reasoningEffort?: 'low' | 'medium' | 'high'
  temperature: number
}) {
  const reasoning =
    reasoningEffort && GROQ_MODEL.startsWith('openai/gpt-oss')
      ? { reasoning_effort: reasoningEffort, reasoning_format: 'hidden' }
      : {}

  if (!process.env.GROQ_API_KEY) {
    throw new GroqRequestError('GROQ_API_KEY missing')
  }

  const res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      response_format: { type: 'json_object' },
      messages,
      temperature,
      ...reasoning,
    }),
  })

  const json = (await res.json().catch(() => ({}))) as GroqChatCompletionResponse

  if (!res.ok) {
    const code = typeof json.error?.code === 'string' ? json.error.code : `http_${res.status}`
    const message = typeof json.error?.message === 'string' ? json.error.message : res.statusText
    throw new GroqRequestError(`${code}: ${message}`)
  }

  return (json.choices?.[0]?.message?.content ?? '').trim()
}

function normalizeSymbolSearchTerms(value: unknown, original: string) {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const terms: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') continue
    const term = item.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, ' ').trim()
    if (!term || term.length > 40 || term === original.toLowerCase() || seen.has(term)) continue
    seen.add(term)
    terms.push(term)
    if (terms.length >= 8) break
  }

  return terms
}

const SYMBOL_SEARCH_TERMS_PROMPT = [
  'You create pictogram search terms for AAC communication board cards.',
  'Input can be Estonian or English, one word or a short phrase.',
  'Return an ordered list of English search terms that are likely to exist as simple AAC pictograms (ARASAAC, Mulberry).',
  '',
  'Rules:',
  '1) Prefer concrete base words: nouns, verbs, adjectives, and common AAC concepts.',
  '2) Include translations and close synonyms, not explanations.',
  '3) For phrases, include the main concept first, then useful phrase-level alternatives.',
  '4) Use lowercase English only.',
  '5) Do not include Estonian terms unless the input is already English-looking.',
  '6) Put the most likely exact pictogram search term first, then synonyms or broader alternatives.',
  '7) Return 5-8 terms when possible.',
  '',
  'Examples:',
  '- eksam -> exam, examination, test',
  '- vahetund -> break, recess',
  '- söökla -> cafeteria, canteen',
  '',
  'Return ONLY JSON: {"terms":["..."]}',
].join('\n')

/**
 * English pictogram search terms for a card label. Never throws: on a Groq failure it returns no terms
 * and the error, so callers can keep going without them.
 */
export async function getSymbolSearchTerms(
  label: string,
): Promise<{ error?: string; terms: string[] }> {
  try {
    const txt = await createGroqJsonCompletion({
      messages: [
        { role: 'system', content: SYMBOL_SEARCH_TERMS_PROMPT },
        { role: 'user', content: `Card label: ${label}` },
      ],
      temperature: 0.2,
    })
    const parsed = JSON.parse(txt) as { terms?: unknown }

    return { terms: normalizeSymbolSearchTerms(parsed.terms, label) }
  } catch (error) {
    console.error('Groq symbol search terms failed', error)
    return {
      error: error instanceof Error ? error.message : 'groq_request_failed',
      terms: [],
    }
  }
}

const PICTOGRAM_SUBJECT_PROMPT = [
  'You describe what a pictogram on an AAC communication board card should show.',
  'Input is a card label in Estonian or English: one word or a short phrase.',
  'Return one short English description (at most 15 words) of a single, simple, concrete scene that a child recognises as the label.',
  'Also say whether the label is personal: generated pictures of generic labels are shared with every family that uses the app.',
  '',
  'Rules:',
  '1) Concrete nouns: the object itself. Example: koer -> a brown dog',
  '2) Verbs: a child doing the action. Example: jooma -> a child drinking from a cup',
  '3) Abstract words: the gesture or situation people use for it. Example: veel -> a hand asking for more food on a plate',
  '4) Keep it simple: one object or at most two people, no crowds or busy backgrounds.',
  '5) No text, letters, numbers or signs in the description.',
  '6) No names of real people, brands or characters in the description.',
  '7) personal is true when the label contains a name of a person, pet, school, kindergarten or place, or other private detail (e.g. "vanaema Malle", "Muki", "Pähklikese lasteaed"). Family roles and common words are not personal ("vanaema", "koer", "lasteaed").',
  '',
  'Return ONLY JSON: {"subject":"...","personal":false}',
].join('\n')

/**
 * An English scene description for generating a pictogram, and whether the label is personal (a
 * personal label's picture is not shared). Falls back to the label itself, and to personal, so a
 * Groq failure never shares a picture by mistake.
 */
export async function getPictogramSubject(
  label: string,
): Promise<{ personal: boolean; subject: string }> {
  try {
    const txt = await createGroqJsonCompletion({
      messages: [
        { role: 'system', content: PICTOGRAM_SUBJECT_PROMPT },
        { role: 'user', content: `Card label: ${label}` },
      ],
      temperature: 0.2,
    })
    const parsed = JSON.parse(txt) as { personal?: unknown; subject?: unknown }
    const subject = typeof parsed.subject === 'string' ? parsed.subject.trim() : ''

    return {
      personal: parsed.personal !== false,
      subject: subject && subject.length <= 200 ? subject : label,
    }
  } catch (error) {
    console.error('Groq pictogram subject failed', error)
    return { personal: true, subject: label }
  }
}
