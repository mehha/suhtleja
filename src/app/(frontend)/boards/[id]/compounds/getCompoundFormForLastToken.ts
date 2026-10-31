import type { Board } from '@/payload-types'
import { applyCompounds, type SelectedToken } from './applyCompounds'

/**
 * The form in which the runner says the word just tapped (the last token): the form it has in the
 * sentence, from `applyCompounds`, so the tap and "play all" say it the same way. That is a whole
 * compound's form, or that of a compound the sentence has started (two or more of its first words
 * tapped).
 *
 * Returns null when no compound applies, and the word is said as it is.
 */
export function getCompoundFormForLastToken(
  tokens: SelectedToken[],
  rules: Board['compounds'] | null | undefined,
): { surface: string; tts: string } | null {
  if (!rules?.length || tokens.length === 0) return null

  const last = applyCompounds(tokens, rules).tokens.at(-1)!
  return last.compoundId ? { surface: last.surface, tts: last.tts } : null
}
