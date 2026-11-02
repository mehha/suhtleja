'use client'

import { useActionState, useState } from 'react'
import { Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SPEECH_RATES, TTS_VOICES, speechRate, type SpeechRate, type TTSVoice } from '@/utilities/speechSettings'
import { updateSpeechAction } from './actions'
import { InfoRow } from './InfoRow'

const initialState = {
  success: false,
  error: undefined as string | undefined,
}

// What "Kuula" says, so the parent hears the voice and the rate before saving them.
const SAMPLE = 'Tere! Mina tahan mängida.'

type Props = {
  voice?: string | null
  rate?: string | null
  isParentMode: boolean
}

const voiceOf = (value?: string | null): TTSVoice =>
  value && value in TTS_VOICES ? (value as TTSVoice) : 'et-EE-AnuNeural'

/** The voice and the rate the boards speak with (users.speechVoice, speechRate). */
export function ProfileSpeechForm({ voice, rate, isParentMode }: Props) {
  const [state, formAction, pending] = useActionState(updateSpeechAction, initialState)
  const [chosenVoice, setChosenVoice] = useState<TTSVoice>(voiceOf(voice))
  const [chosenRate, setChosenRate] = useState<SpeechRate>(speechRate(rate))
  const [listening, setListening] = useState(false)

  if (!isParentMode) {
    return (
      <div className="space-y-3 text-sm">
        <InfoRow label="Hääl">{TTS_VOICES[voiceOf(voice)]}</InfoRow>
        <InfoRow label="Kõnekiirus">{SPEECH_RATES[speechRate(rate)].label}</InfoRow>
        <p className="text-muted-foreground">Hääle muutmiseks ava vanema vaade (ülal paremal).</p>
      </div>
    )
  }

  const listen = async () => {
    setListening(true)
    try {
      const response = await fetch('/next/tts-ms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: SAMPLE, speaker: chosenVoice, rate: chosenRate }),
      })
      if (!response.ok) return
      const url = URL.createObjectURL(await response.blob())
      const audio = new Audio(url)
      audio.onended = () => URL.revokeObjectURL(url)
      await audio.play().catch(() => URL.revokeObjectURL(url))
    } finally {
      setListening(false)
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-voice">Hääl</Label>
          <Select name="voice" value={chosenVoice} onValueChange={(value) => setChosenVoice(value as TTSVoice)}>
            <SelectTrigger id="profile-voice" className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TTS_VOICES).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-rate">Kõnekiirus</Label>
          <Select name="rate" value={chosenRate} onValueChange={(value) => setChosenRate(value as SpeechRate)}>
            <SelectTrigger id="profile-rate" className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SPEECH_RATES).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="gap-2" onClick={() => void listen()} disabled={listening}>
          <Volume2 className="h-4 w-4" aria-hidden="true" />
          {listening ? 'Laen…' : 'Kuula'}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvestan…' : 'Salvesta hääl'}
        </Button>
      </div>

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state.success && !state.error && <p className="text-sm text-emerald-600">Hääl salvestatud.</p>}
    </form>
  )
}
