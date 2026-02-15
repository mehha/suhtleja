import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode, headers } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { Toaster } from '@/components/ui/sonner'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()

  const { user } = await payload.auth({ headers: requestHeaders })
  const isAdmin = user?.role === 'admin'

  return (
    <html className={cn(GeistSans.variable, GeistMono.variable)} lang="en" suppressHydrationWarning>
      <head>
        <InitTheme />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body className="bg-gray-50 dark:bg-gray-900">
        <Providers>
          {isAdmin && (
            <AdminBar
              adminBarProps={{
                preview: isEnabled,
                createProps: {
                  target: '_self',
                },
                editProps: {
                  target: '_self',
                },
                logoutProps: {
                  target: '_self',
                },
              }}
            />
          )}

          <Toaster />
          <Header />
          <div className="py-10 px-4">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@payloadcms',
  },
}
