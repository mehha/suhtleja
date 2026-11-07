import type { KeyboardEvent } from 'react'

// Touch screens (phones and tablets, also an iPad with a keyboard case) bring up the on-screen
// keyboard for a text field with the cursor. It covers almost half of a tablet turned sideways.
const isTouchScreen = () => window.matchMedia('(pointer: coarse)').matches

// For a dialog where the parent mostly taps, as `onOpenAutoFocus`: on a touch screen the dialog
// itself gets the focus, not its first field, and the keyboard comes up only when the parent taps a
// field. A computer keeps the cursor in the field.
export function openWithoutKeyboardOnTouch(event: Event) {
  if (!isTouchScreen()) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement | null)?.focus()
}

// Enter in a field that searches as you type: nothing is submitted or closed, and on a touch screen
// the keyboard closes, so the results under the field show.
export function closeKeyboardOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
  event.preventDefault()
  if (isTouchScreen()) event.currentTarget.blur()
}
