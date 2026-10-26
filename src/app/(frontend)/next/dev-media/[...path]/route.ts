import { NextResponse } from 'next/server'
import { getPayloadCloudflareContext } from '@/utilities/getCloudflareContext'
import { PUBLIC_MEDIA_BASE_URL } from '@/utilities/mediaURL'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{
    path: string[]
  }>
}

// Outside production, media URLs point here (src/utilities/mediaURL.ts). Uploads made locally are
// in the local R2 bucket; media copied from production is only on the public media domain, so that
// is fetched and passed through. Proxied rather than redirected, because Next's image optimizer
// doesn't follow a redirect for a local image.
export async function GET(req: Request, { params }: RouteContext) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { path } = await params
  const key = path.join('/')

  const cloudflare = await getPayloadCloudflareContext()
  const object = await cloudflare.env.R2.get(key)

  if (object?.body) {
    const headers = new Headers({ 'Cache-Control': 'no-store' })
    if (object.httpMetadata?.contentType) headers.set('Content-Type', object.httpMetadata.contentType)
    headers.set('Content-Length', String(object.size))
    return new NextResponse(object.body, { status: 200, headers })
  }

  // Pass Range through, so a production video can still be scrubbed.
  const range = req.headers.get('range')
  const upstream = await fetch(`${PUBLIC_MEDIA_BASE_URL}/${path.map(encodeURIComponent).join('/')}`, {
    headers: range ? { range } : undefined,
  })

  const headers = new Headers({ 'Cache-Control': 'no-store' })
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers })
}
