'use client'

import React, { createContext, useCallback, use, useEffect, useState } from 'react'

import type { Theme, ThemeContextType } from './types'

import { defaultTheme, themeLocalStorageKey } from './shared'

const initialContext: ThemeContextType = {
  setTheme: () => null,
  theme: undefined,
}

const ThemeContext = createContext(initialContext)

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // The site is always light (the effect below puts it on the page), on the server and in the browser.
  const [theme, setThemeState] = useState<Theme | undefined>(defaultTheme)

  const setTheme = useCallback((themeToSet: Theme | null) => {
    const nextTheme = themeToSet === 'dark' || themeToSet === null ? 'light' : themeToSet
    window.localStorage.removeItem(themeLocalStorageKey)
    setThemeState(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
  }, [])

  useEffect(() => {
    window.localStorage.removeItem(themeLocalStorageKey)
    document.documentElement.setAttribute('data-theme', defaultTheme)
  }, [])

  return <ThemeContext value={{ setTheme, theme }}>{children}</ThemeContext>
}

export const useTheme = (): ThemeContextType => use(ThemeContext)
