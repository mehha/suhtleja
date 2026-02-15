import { useEffect, useState } from 'react'

type Collection = 'pages' | 'posts'

export function useFetchPageOrPost({
  collection,
  slug,
}: {
  collection?: Collection
  slug?: string
}) {
  const [id, setId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!collection || !slug) {
      setId(undefined)
      return
    }

    let cancelled = false

    const fetchData = async () => {
      try {
        const url = `/api/${collection}?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=0`
        const response = await fetch(url, { credentials: 'include' })
        if (!response.ok) {
          if (!cancelled) setId(undefined)
          return
        }

        const result = await response.json()
        const foundId = result?.docs?.[0]?.id

        if (!cancelled) {
          setId(typeof foundId === 'string' || typeof foundId === 'number' ? String(foundId) : undefined)
        }
      } catch (error) {
        if (!cancelled) setId(undefined)
        console.error('Fetch error:', error instanceof Error ? error.message : error)
      }
    }

    void fetchData()

    return () => {
      cancelled = true
    }
  }, [collection, slug])

  return id
}
