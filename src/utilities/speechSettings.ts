// The voices and speech rates a member picks on the profile page (users.speechVoice, speechRate).
// A plain module, so the profile form can import it; src/utilities/azureTTS.ts speaks with them.

// By Azure name.
export const TTS_VOICES = {
  'et-EE-AnuNeural': 'Anu',
  'et-EE-KertNeural': 'Kert',
} as const

export type TTSVoice = keyof typeof TTS_VOICES

// As SSML prosody: a child who needs time to follow hears the words slower.
export const SPEECH_RATES = {
  slow: { label: 'Aeglane', prosody: '-25%' },
  normal: { label: 'Tavaline', prosody: null },
  fast: { label: 'Kiire', prosody: '+20%' },
} as const

export type SpeechRate = keyof typeof SPEECH_RATES

/** A speech rate; anything else is 'normal'. */
export function speechRate(value: unknown): SpeechRate {
  return typeof value === 'string' && value in SPEECH_RATES ? (value as SpeechRate) : 'normal'
}
