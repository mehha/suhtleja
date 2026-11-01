import { useEffect, useState } from 'react'

type Collection = 'pages' | 'posts'

type CollectionResponse = {
  docs?: Array<{
    id?: string | number
  }>
}

export function useFetchPageOrPost({
  collection,
  slug,
}: {
  collection?: Collection
  slug?: string
}) {
  // The id found for a page or post, with the slug it was found for: a new slug shows nothing until
  // its own answer comes.
  const key = collection && slug ? `${collection}/${slug}` : null
  const [found, setFound] = useState<{ key: string; id: string | undefined } | null>(null)

  useEffect(() => {
    if (!collection || !slug || !key) return

    let cancelled = false
    const settle = (id: string | undefined) => {
      if (!cancelled) setFound({ key, id })
    }

    const fetchData = async () => {
      try {
        const url = `/api/${collection}?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=0`
        const response = await fetch(url, { credentials: 'include' })
        if (!response.ok) {
          settle(undefined)
          return
        }

        const result = (await response.json()) as CollectionResponse
        const foundId = result?.docs?.[0]?.id
        settle(typeof foundId === 'string' || typeof foundId === 'number' ? String(foundId) : undefined)
      } catch (error) {
        settle(undefined)
        console.error('Fetch error:', error instanceof Error ? error.message : error)
      }
    }

    void fetchData()

    return () => {
      cancelled = true
    }
  }, [collection, slug, key])

  const id = found && found.key === key ? found.id : undefined
  return id
}
