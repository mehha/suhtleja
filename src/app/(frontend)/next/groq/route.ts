// app/(frontend)/next/groq/route.ts
import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { createGroqJsonCompletion, getSentenceForms, getSymbolSearchTerms, sentenceWords } from '@/utilities/groq'
import { hasActiveMembership } from '@/utilities/membershipStatus'

export const runtime = 'nodejs'

type GroqBody = {
  contextTail?: string[]
  task?: 'symbol-search-terms' | 'sentence'
  token?: string
  words?: unknown
}

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY missing' }, { status: 500 })
  }

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!hasActiveMembership(user as User)) {
    return NextResponse.json({ error: 'membership_required' }, { status: 402 })
  }

  const body = (await req.json().catch(() => ({}))) as GroqBody

  // The board's AI: the whole sentence at once (Runner.tsx), the same words back in their forms.
  if (body.task === 'sentence') {
    const words = sentenceWords(body.words)
    if (!words) return NextResponse.json({ error: 'invalid words' }, { status: 400 })
    const { error, words: forms } = await getSentenceForms(words)
    return NextResponse.json(error ? { error, words: forms } : { words: forms })
  }

  const raw = (body.token ?? '').trim()
  if (!raw) return NextResponse.json({ error: 'missing token' }, { status: 400 })

  if (body.task === 'symbol-search-terms') {
    const { error, terms } = await getSymbolSearchTerms(raw)
    return NextResponse.json(error ? { error, terms } : { terms })
  }

  const tail = Array.isArray(body.contextTail) ? body.contextTail : []

  // Esimest tokenit ei muudeta – odavam, pole vaja Groq’i üldse
  if (tail.length === 0) {
    return NextResponse.json({ surface: raw })
  }

  // piirame konteksti 2 viimasele – piisav, odav
  const context = tail.slice(-2).join(' ')

  const system = [
    'Sa parandad eesti keele morfosüntaksit ühe tokeni kaupa.',
    'Sulle antakse:',
    '- "Kontekst": 0–2 eelmist sõna (või fraasi),',
    '- "Token": praegune sõna või fraas, mida tuleb kohandada.',
    '',
    'Reeglid:',
    '1) Ära lisa ega kustuta sõnu.',
    '2) Hoia tokeni tüvi sama, muuda ainult vormi (kääne/pööre/lõpp).',
    '3) Kui token sisaldab mitu sõna, muuda ainult VIIMAST sõna.',
    '4) Kasuta vajadusel õiget mitmuse käänet (nt "kaks kass" → "kaks kassi").',
    '5) Kohakäänded: olek/seisund → seesütlev ("koolis"), liikumine → sisseütlev ("kooli").',
    '',
    'Tagasta VAINULT JSON kujul: {"surface":"..."}',
  ].join('\n')

  const prompt = [
    `Kontekst: ${context || '-'}`,
    `Token: ${raw}`,
    'Vastus:',
  ].join('\n')

  try {
    const txt = await createGroqJsonCompletion({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      reasoningEffort: 'low',
      temperature: 0,
    })

    let surface = raw

    try {
      const parsed = JSON.parse(txt) as { surface?: string }
      if (parsed?.surface && parsed.surface.trim()) {
        surface = parsed.surface.trim()
      }
    } catch {
      // fallback, kui mudel ikka midagi muud lisab
      const m = txt.match(/\{\s*"surface"\s*:\s*"([^"]*)"\s*\}/)
      if (m) surface = m[1]
    }

    // Turvavõrk mitmesõnalise tokeni puhul: prefix peab jääma samaks
    if (raw.includes(' ')) {
      const parts = raw.split(/\s+/)
      const prefix = parts.slice(0, -1).join(' ')
      if (!surface.startsWith(prefix + ' ')) {
        const outLast = surface.split(/\s+/).pop() ?? parts[parts.length - 1]
        surface = `${prefix} ${outLast}`
      }
    }

    return NextResponse.json({ surface })
  } catch (error) {
    // Soft-fail: kui Groq error, loeme lihtsalt algset tokenit
    console.error('Groq word form failed', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'groq_request_failed',
        surface: raw,
      },
      { status: 200 },
    )
  }
}
