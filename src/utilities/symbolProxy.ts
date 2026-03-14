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

    if (url.hostname === 'unpkg.com') {
      return url.pathname.includes('/openmoji@')
    }

    return false
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
