'use client'

import { useEffect, useState } from 'react'

// The word forms (applyGrammar and its word lists, about 30 kB gzipped) are a chunk of their own,
// loaded after the board shows: the runner and the card dialog import them through here, never
// directly. The server (the speech cache) imports applyGrammar as usual.

export type Grammar = typeof import('./applyGrammar')

let loaded: Grammar | null = null
let loading: Promise<Grammar> | null = null

/** The word forms, loading them once. A tap before they are in waits for them. */
export function loadGrammar(): Promise<Grammar> {
  loading ??= import('./applyGrammar').then((grammar) => (loaded = grammar))
  return loading
}

/** The word forms once loaded (null until then, and while `enabled` is false). */
export function useGrammar(enabled = true): Grammar | null {
  const [grammar, setGrammar] = useState<Grammar | null>(loaded)

  useEffect(() => {
    if (!enabled || grammar) return
    let current = true
    void loadGrammar().then((module) => {
      if (current) setGrammar(module)
    })
    return () => {
      current = false
    }
  }, [enabled, grammar])

  return enabled ? grammar : null
}
