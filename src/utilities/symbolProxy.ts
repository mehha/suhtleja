const SYMBOL_PROXY_ROUTE = '/next/symbol-image'

export function isProxyableSymbolURL(value: string): boolean {
  try {
    const url = new URL(value)

    if (url.protocol !== 'https:') {
      return false
    }

    if (url.hostname === 'static.arasaac.org') {
      return url.pathname.startsWith('/pictograms/')
    }

    // Mulberry Symbols images that the Global Symbols API links to.
    if (url.hostname === 'globalsymbols.com') {
      return url.pathname.startsWith('/uploads/production/image/')
    }

    if (url.hostname === 'unpkg.com') {
      return url.pathname.includes('/openmoji@')
    }

    return false
  } catch {
    return false
  }
}

/**
 * Next's image optimizer refuses SVG ("image type is not allowed"), and OpenMoji and Mulberry symbols
 * are SVG. Render those with `unoptimized`.
 */
export function isSvgImageURL(src?: string | null): boolean {
  if (!src) return false

  try {
    return new URL(src, 'http://localhost').pathname.toLowerCase().endsWith('.svg')
  } catch {
    return false
  }
}

export function getSymbolProxyURL(value?: string | null): string | null {
  if (!value) {
    return null
  }

  if (value.startsWith(`${SYMBOL_PROXY_ROUTE}?`)) {
    return value
  }

  if (!isProxyableSymbolURL(value)) {
    return value
  }

  return `${SYMBOL_PROXY_ROUTE}?src=${encodeURIComponent(value)}`
}
