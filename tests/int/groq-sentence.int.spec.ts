// @vitest-environment node

// The board's AI for a whole sentence (/next/groq, task "sentence"): which requests it takes, and
// which of the AI's answers it accepts. Anything off keeps the sentence as it was.

import { describe, expect, it } from 'vitest'

import { SENTENCE_MAX_WORDS, acceptSentenceForms, sentenceWords } from '@/utilities/groq'

describe("the board's sentence AI", () => {
  it('takes 2 to SENTENCE_MAX_WORDS short words', () => {
    expect(sentenceWords(['mina', 'magan', 'voodi'])).toEqual(['mina', 'magan', 'voodi'])
    expect(sentenceWords([' mina ', 'magan'])).toEqual(['mina', 'magan'])
    expect(sentenceWords(['mina'])).toBeNull()
    expect(sentenceWords(Array(SENTENCE_MAX_WORDS + 1).fill('kass'))).toBeNull()
    expect(sentenceWords(['mina', ''])).toBeNull()
    expect(sentenceWords(['mina', 'x'.repeat(41)])).toBeNull()
    expect(sentenceWords('mina magan')).toBeNull()
  })

  it("accepts the AI's forms word for word", () => {
    expect(acceptSentenceForms(['mina', 'magan', 'voodi'], ['mina', 'magan', 'voodis'])).toEqual(['mina', 'magan', 'voodis'])
  })

  it('keeps the sentence when the AI changes the number of words', () => {
    const words = ['mina', 'magan', 'voodi']
    expect(acceptSentenceForms(words, ['mina', 'magan', 'oma', 'voodis'])).toBe(words)
    expect(acceptSentenceForms(words, 'mina magan voodis')).toBe(words)
  })

  it('keeps a word whose form is empty, not text or far longer', () => {
    expect(acceptSentenceForms(['mina', 'kass'], ['', 'kassi'])).toEqual(['mina', 'kassi'])
    expect(acceptSentenceForms(['mina', 'kass'], [7, 'kassi'])).toEqual(['mina', 'kassi'])
    expect(acceptSentenceForms(['mina', 'kass'], ['mina', 'kass ja koer ja hiir'])).toEqual(['mina', 'kass'])
  })
})
