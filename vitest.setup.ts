// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

// jsdom has no matchMedia, which the app calls (touchScreen.ts, Reveal.tsx). The component tests run
// as on a computer: no media query matches (no touch screen, no reduced motion).
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
