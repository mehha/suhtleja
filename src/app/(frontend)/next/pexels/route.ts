// src/app/(frontend)/api/pexels/route.ts
import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { hasActiveMembership } from '@/utilities/membershipStatus'

export async function GET(req: Request) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!hasActiveMembership(user as User)) {
    return NextResponse.json({ error: 'membership_required' }, { status: 402 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || 'cat'

  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=20`, {
    headers: {
      Authorization: process.env.PEXELS_API_KEY || '',
    },
  })

  if (!res.ok) {
    return NextResponse.json({ photos: [] }, { status: 200 })
  }

  const json = await res.json()
  return NextResponse.json(json)
}
