'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/utilities/ui'

// One-time entrance for content below the fold. The server HTML stays fully visible: after
// hydration, only content that hasn't been seen yet is marked `data-reveal="pending"`, and it
// switches to `"in"` when it scrolls into view. Children style themselves with
// `group-data-[reveal=pending]/reveal:` and `group-data-[reveal=in]/reveal:` variants.
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Already on screen (or scrolled past): show it as it is.
    if (element.getBoundingClientRect().top < window.innerHeight) return

    element.dataset.reveal = 'pending'
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          element.dataset.reveal = 'in'
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={cn('group/reveal', className)}>
      {children}
    </div>
  )
}
