import type { Compound } from './applyCompounds'

export const COMPOUND_TOO_SHORT = 'Sõnaühendis peab olema vähemalt kaks kaarti.'
export const COMPOUND_MISSING_CELL = 'Vali igale reale kaart.'
export const COMPOUND_MISSING_WORD = 'Kirjuta igale kaardile sõna.'

// What keeps a compound from being saved, or null. The editor and the save action both check it.
export function getCompoundProblem(compound: Compound): string | null {
  const cells = compound.cells ?? []
  const parts = compound.parts ?? []

  if (cells.length < 2) return COMPOUND_TOO_SHORT
  if (cells.some((cell) => !cell.cellId?.trim())) return COMPOUND_MISSING_CELL
  if (parts.length !== cells.length || parts.some((part) => !part.surface?.trim())) {
    return COMPOUND_MISSING_WORD
  }
  return null
}

export function findCompoundsProblem(compounds: Compound[]): string | null {
  for (const compound of compounds) {
    const problem = getCompoundProblem(compound)
    if (problem) return problem
  }
  return null
}
