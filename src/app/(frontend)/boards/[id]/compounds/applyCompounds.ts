import type { Board } from '@/payload-types'

export type SelectedToken = {
  id: string
  text: string
}

export type Compound = NonNullable<Board['compounds']>[number]

export type NormalizedToken = {
  id: string
  surface: string
  tts: string
  // The compound whose form this word takes: a whole one that matched here, or one the sentence
  // has started at its end.
  compoundId?: string
}

type Part = NonNullable<Compound['parts']>[number]

type CompoundRule = {
  id: string
  pattern: string[]
  parts: Part[]
  // Position in the editor's list.
  order: number
}

// Rules that can match: at least one cell and a word for every cell. In the editor's order.
function getCompoundRules(rules: Compound[] | null | undefined): CompoundRule[] {
  return (rules ?? []).flatMap((rule, order) => {
    const pattern = rule.cells?.map((c) => c.cellId) ?? []
    const parts = rule.parts ?? []
    if (!pattern.length || parts.length !== pattern.length) return []
    return [{ id: rule.id || String(order), pattern, parts, order }]
  })
}

// A word in a compound's form: the compound's word, its own speech or else that word, and the
// tapped word where the compound leaves a part empty.
function getPartForm(part: Part | undefined, word: { surface: string; tts: string }) {
  const surface = (part?.surface ?? '').trim()
  const tts = (part?.tts ?? '').trim()
  return {
    surface: surface || word.surface,
    tts: tts || surface || word.tts,
  }
}

export function applyCompounds(
  tokens: SelectedToken[],
  rules: Compound[] | null | undefined,
): { display: string; tts: string; tokens: NormalizedToken[] } {
  const normalized: NormalizedToken[] = tokens.map((t) => ({
    id: t.id,
    surface: t.text,
    tts: t.text,
  }))

  // When compounds overlap, a word takes the form of the longest one, since it knows more of the
  // sentence; between compounds of the same length, the earlier one in the editor's list wins.
  const byPriority = getCompoundRules(rules).sort(
    (a, b) => b.pattern.length - a.pattern.length || a.order - b.order,
  )

  for (const rule of byPriority) {
    const length = rule.pattern.length

    for (let i = 0; i + length <= normalized.length; i++) {
      if (!rule.pattern.every((cellId, j) => normalized[i + j].id === cellId)) continue

      for (let j = 0; j < length; j++) {
        const token = normalized[i + j]
        if (token.compoundId) continue
        Object.assign(token, getPartForm(rule.parts[j], token), { compoundId: rule.id })
      }
    }
  }

  // A compound the child has started: its first cells, two or more, are the last words tapped.
  // Those words take its forms already ("poiss mängima" says "poiss mängib" before "korvpall"),
  // so the sentence sounds right while it's built. One word doesn't start a compound: a word never
  // changes form only because a compound begins with it. The compound that matches the most words
  // wins, then the earlier one in the editor's list; words of a whole compound keep its forms.
  const n = normalized.length
  let started: { rule: CompoundRule; k: number } | null = null

  for (const rule of getCompoundRules(rules)) {
    for (let k = Math.min(rule.pattern.length - 1, n); k >= 2; k--) {
      if (!rule.pattern.slice(0, k).every((cellId, j) => normalized[n - k + j].id === cellId)) continue
      if (!started || k > started.k) started = { rule, k }
      break
    }
  }

  if (started) {
    for (let j = 0; j < started.k; j++) {
      const token = normalized[n - started.k + j]
      if (token.compoundId) continue
      Object.assign(token, getPartForm(started.rule.parts[j], token), { compoundId: started.rule.id })
    }
  }

  const display = normalized.map((t) => t.surface).join(' ')
  const tts = normalized.map((t) => t.tts).join(' ')

  return { display, tts, tokens: normalized }
}
