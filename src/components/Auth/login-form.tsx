'use client'

import * as React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
import Link from 'next/link'

type LoginFormProps = React.ComponentPropsWithoutRef<'div'>

type AuthResponse = {
  message?: string
}

export function LoginForm({ className, ...props }: LoginFormProps) {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    // Read from the fields, not from React state: a password manager can fill them before the page's
    // JavaScript runs, and state would miss that. They are found by id and have no name, so a form
    // sent before the JavaScript runs doesn't put the password in the address.
    const field = (id: string) => (e.currentTarget.elements.namedItem(id) as HTMLInputElement | null)?.value ?? ''
    const email = field('email')
    const password = field('password')
    setLoading(true)

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = (await res.json().catch(() => null)) as AuthResponse | null

      if (!res.ok) {
        setError(data?.message ?? 'Sisselogimine ebaõnnestus')
        setLoading(false)
        return
      }

      // 👉 siin paneme uiMode=child
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
          <CardTitle className="text-2xl">Logi sisse</CardTitle>
          <CardDescription>
            Sisesta oma e-post ja parool, et oma kontole sisse logida.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nimi@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Parool</Label>
                <a
                  href="#"
                  className="hidden ml-auto text-sm underline-offset-4 hover:underline"
                >
                  Unustasid parooli?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Sisselogimine…' : 'Logi sisse'}
            </Button>

            <p className="mt-2 text-center text-sm text-muted-foreground">
              Pole kontot?{' '}
              <Link href='/register' className="underline underline-offset-4">
                Registreeru
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
