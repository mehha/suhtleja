'use client'

import { useActionState } from 'react'
import { updateNameAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState = {
  success: false,
  error: undefined as string | undefined,
}

type Props = {
  name?: string | null
  isParentMode: boolean
}

export function ProfileNameForm({ name, isParentMode }: Props) {
  const [state, formAction, pending] = useActionState(updateNameAction, initialState)

  if (!isParentMode) {
    return (
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Nimi</span>
          <span>{name || '—'}</span>
        </div>
        <p className="text-muted-foreground">Nime muutmiseks ava vanema vaade (ülal paremal).</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-2">
      <Label htmlFor="profile-name">Nimi</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="profile-name"
          name="name"
          autoComplete="name"
          placeholder="nt. Mari Maasikas"
          required
          defaultValue={name ?? ''}
          className="max-w-xs"
        />
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvestan…' : 'Salvesta nimi'}
        </Button>
      </div>

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state.success && !state.error && (
        <p className="text-sm text-emerald-600">Nimi salvestatud.</p>
      )}
    </form>
  )
}
