// How well a picture's name answers a search in the card editor (`searchPictureMedia` in
// findLibraryMedia.ts). The database finds every name that contains the query; this keeps the
// names where the query starts a word, or ends one when the query has 4 letters or more (a
// compound's last part: "õhupall", "veoauto"), and ranks them. A match inside a word ("leib" for
// "ei", "lõunauni" for "õun") is dropped, and so are word endings of shorter queries: those are
// mostly grammar ("veerema", "pugema" for "ema").

/** Shortest query whose match at the end of a word counts, as a compound's last part. */
const COMPOUND_TAIL_MIN = 4

const normalize = (text: string) => text.normalize('NFC').toLocaleLowerCase('et').trim()
const isWordCharacter = (character: string | undefined) => !!character && /[\p{L}\p{N}]/u.test(character)

/**
 * 0: the name is the query; 1: the name starts with it; 2: a later word does ("ma ei taha");
 * 3: it ends a word ("õhupall" for "pall"); null: no match worth showing.
 */
export function pictureMatchRank(name: string, query: string): number | null {
  const text = normalize(name)
  const q = normalize(query)
  if (!text || !q) return null
  if (text === q) return 0

  let best: number | null = null
  for (let at = text.indexOf(q); at !== -1; at = text.indexOf(q, at + 1)) {
    const startsWord = !isWordCharacter(text[at - 1])
    const endsWord = !isWordCharacter(text[at + q.length])
    const rank = startsWord ? (at === 0 ? 1 : 2) : endsWord && [...q].length >= COMPOUND_TAIL_MIN ? 3 : null
    if (rank !== null && (best === null || rank < best)) best = rank
  }
  return best
}

/**
 * The items whose names match `query`, best first: by rank, then the shorter name, then in the
 * given order. An item has several names (its alt text and file name); the best one counts.
 */
export function rankPictureMatches<T>(items: T[], query: string, names: (item: T) => string[]): T[] {
  return items
    .flatMap((item, index) => {
      let rank: number | null = null
      let length = Infinity
      for (const name of names(item)) {
        const nameRank = pictureMatchRank(name, query)
        if (nameRank === null) continue
        if (rank === null || nameRank < rank || (nameRank === rank && name.length < length)) {
          rank = nameRank
          length = name.length
        }
      }
      return rank === null ? [] : [{ index, item, length, rank }]
    })
    .sort((a, b) => a.rank - b.rank || a.length - b.length || a.index - b.index)
    .map(({ item }) => item)
}
