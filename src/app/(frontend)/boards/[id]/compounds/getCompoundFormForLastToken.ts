import type { Board } from '@/payload-types'
import { applyCompounds, type SelectedToken } from './applyCompounds'

/**
 * The form in which the runner says the word just tapped (the last token): when a whole compound
 * ends with this word, the form it has in the sentence, from `applyCompounds`, so the tap and
 * "play all" say it the same way. A compound that is only started changes nothing: the word is
 * said as tapped until the whole compound is there.
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
