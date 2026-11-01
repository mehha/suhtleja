// How a board's cards write their words (users.labelCase, set on the profile page): in capitals,
// in small letters, or as a sentence starts. A child learning to read may know one of them first.
// Only the display changes (CSS text-transform): the word, its speech and its name stay as typed.

export const LABEL_CASES = {
  upper: 'SUURTÄHED',
  lower: 'väiketähed',
  sentence: 'Suur algustäht',
} as const

export type LabelCase = keyof typeof LABEL_CASES

/** A label case; anything else is 'upper', the boards' look before the setting. */
export function labelCase(value: unknown): LabelCase {
  return typeof value === 'string' && value in LABEL_CASES ? (value as LabelCase) : 'upper'
}

// Tailwind classes for a label's text (a block, so first-letter applies).
export const LABEL_CASE_CLASS: Record<LabelCase, string> = {
  upper: 'uppercase',
  lower: 'lowercase',
  sentence: 'lowercase first-letter:uppercase',
}
