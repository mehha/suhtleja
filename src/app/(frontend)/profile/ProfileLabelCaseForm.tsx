'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LABEL_CASES, LABEL_CASE_CLASS, labelCase, type LabelCase } from '@/utilities/labelCase'
import { cn } from '@/utilities/ui'
import { updateLabelCaseAction } from './actions'
import { InfoRow } from './InfoRow'

const initialState = {
  success: false,
  error: undefined as string | undefined,
}

// Words shown in the chosen case, so the parent sees it before saving.
const SAMPLE = ['ema', 'tahan', 'süüa']

type Props = {
  value?: string | null
  isParentMode: boolean
}

/** How the cards write their words (users.labelCase). */
export function ProfileLabelCaseForm({ value, isParentMode }: Props) {
  const [state, formAction, pending] = useActionState(updateLabelCaseAction, initialState)
  const [chosen, setChosen] = useState<LabelCase>(labelCase(value))

  const sample = (
    <div className="flex flex-wrap gap-2" aria-hidden="true">
      {SAMPLE.map((word) => (
        <span
          key={word}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-base font-semibold text-slate-950"
        >
          <span className={cn('inline-block', LABEL_CASE_CLASS[chosen])}>{word}</span>
        </span>
      ))}
    </div>
  )

  if (!isParentMode) {
    return (
      <div className="space-y-2 text-sm">
        <InfoRow label="Kaartide tekst">{LABEL_CASES[labelCase(value)]}</InfoRow>
        <p className="text-muted-foreground">Muutmiseks ava vanema vaade (ülal paremal).</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="profile-label-case">Kaartide tekst</Label>
        <Select name="labelCase" value={chosen} onValueChange={(next) => setChosen(next as LabelCase)}>
          <SelectTrigger id="profile-label-case" className="max-w-xs rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(LABEL_CASES).map(([option, label]) => (
              <SelectItem key={option} value={option}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {sample}
      <Button type="submit" disabled={pending}>
        {pending ? 'Salvestan…' : 'Salvesta'}
      </Button>
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state.success && !state.error && <p className="text-sm text-emerald-600">Kaartide tekst salvestatud.</p>}
    </form>
  )
}
