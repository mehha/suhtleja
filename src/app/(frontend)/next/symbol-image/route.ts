import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { isProxyableSymbolURL } from '@/utilities/symbolProxy'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const src = (searchParams.get('src') || '').trim()

  if (!src || !isProxyableSymbolURL(src)) {
    return NextResponse.json({ error: 'invalid_symbol_url' }, { status: 400 })
  }

  try {
    const upstream = await fetch(src, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    })

    if (!upstream.ok) {
      return NextResponse.json({ error: 'symbol_fetch_failed' }, { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const buffer = await upstream.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
        'Content-Length': String(buffer.byteLength),
        'Content-Type': contentType,
      },
    })
  } catch {
    return NextResponse.json({ error: 'symbol_fetch_failed' }, { status: 502 })
  }
}
