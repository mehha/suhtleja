'use client'

import { usePathname } from 'next/navigation'
import React from 'react'

import { cn } from '@/utilities/ui'
import type { UiMode } from '@/utilities/uiMode'

type FrontendShellProps = {
  adminBar?: React.ReactNode
  children: React.ReactNode
  footer: React.ReactNode
  header: React.ReactNode
  uiMode: UiMode
}

const isChildFullscreenPath = (pathname: string) => {
  if (pathname === '/kodu' || pathname === '/connect-dots') return true

  return /^\/boards\/[^/]+$/.test(pathname)
}

export function FrontendShell({
  adminBar,
  children,
  footer,
  header,
  uiMode,
}: FrontendShellProps) {
  const pathname = usePathname()
  const childFullscreen = uiMode === 'child' && isChildFullscreenPath(pathname)

  return (
    <>
      {!childFullscreen && adminBar}
      {!childFullscreen && header}
      <div className={cn(childFullscreen ? 'min-h-screen px-3 py-3' : 'px-4 py-10')}>
        {children}
      </div>
      {!childFullscreen && footer}
    </>
  )
}
