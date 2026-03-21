'use client'

import * as React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/utilities/ui'
import { getClientSideURL } from '@/utilities/getURL'

type RegisterFormProps = React.ComponentPropsWithoutRef<'div'>

type AuthResponse = {
  message?: string
}

export function RegisterForm({ className, ...props }: RegisterFormProps) {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password !== passwordConfirm) {
      setError('Paroolid ei kattu')
      return
    }

    setLoading(true)

    try {
      const baseUrl = getClientSideURL()

      // 1) Loo kasutaja Payload REST API kaudu
      const createRes = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          name,
        }),
      })

      const createData = (await createRes.json().catch(() => null)) as AuthResponse | null

      if (!createRes.ok) {
        setError(createData?.message ?? 'Registreerimine ebaõnnestus')
        setLoading(false)
        return
      }

      // 2) Logi sisse Payloadi /api/users/login endpointi vastu
      const loginRes = await fetch(`${baseUrl}/api/users/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      const loginData = (await loginRes.json().catch(() => null)) as AuthResponse | null

      if (!loginRes.ok) {
        // Konto loodi, aga login ebaõnnestus – suhtle kasutajaga ausalt
        console.error('Login after register failed', loginData)
        setError('Konto loodi, kuid sisselogimine ebaõnnestus. Proovi sisse logida.')
        setLoading(false)
        return
      }

      // 3) Lisa sinu custom UI cookie (Payload token tuleb HttpOnly cookiena login vastusest)
      if (typeof document !== 'undefined') {
        document.cookie = [
          'uiMode=child',
          'path=/',
          'max-age=' + 60 * 60,
          'samesite=lax',
        ].join('; ')
      }

      router.push('/kodu')
      router.refresh()
    } catch (err) {
      console.error(err)
      setError('Midagi läks valesti. Palun proovi uuesti.')
      setLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Loo konto</CardTitle>
          <CardDescription>
            Sisesta oma andmed uue konto loomiseks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="name">Nimi</Label>
              <Input
                id="name"
                autoComplete="name"
                placeholder="nt. Mari Maasikas"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nimi@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Parool</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="passwordConfirm">Korda parooli</Label>
              <Input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Loon kontot…' : 'Loo konto'}
            </Button>

            <div className="mt-2 text-center text-sm text-muted-foreground">
              Juba konto olemas?{' '}
              <Link href="/login" className="underline underline-offset-4">
                Logi sisse
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Vaikimisi vanema PIN on <span className="font-mono font-semibold">0000</span>.
              Soovi korral saad selle hiljem seadetes muuta.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
