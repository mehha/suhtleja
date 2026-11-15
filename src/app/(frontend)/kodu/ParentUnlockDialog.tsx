'use client'

import React, { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { UnlockState } from '@/utilities/parentUnlock'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { UserLock } from 'lucide-react'
import { PIN_SETTINGS_HREF } from '@/utilities/parentPin'

const initialState: UnlockState = {
  success: false,
  error: undefined,
}

type ParentUnlockDialogProps = {
  hasPin: boolean
  className?: string
  children?: React.ReactNode
}

export function ParentUnlockDialog({ hasPin, className, children }: ParentUnlockDialogProps) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [state, setState] = useState<UnlockState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const submittedPinRef = useRef<string | null>(null)

  // ref esimesele OTP slotile
  const firstSlotRef = useRef<HTMLInputElement | null>(null)

  const submitPin = useCallback(
    async (nextPin: string) => {
      if (nextPin.length !== 4 || isSubmitting || submittedPinRef.current === nextPin) return

      submittedPinRef.current = nextPin
      setIsSubmitting(true)

      // A wrong PIN empties the slots and puts the cursor back in the first one (after the DOM has
      // the empty slots).
      const tryAgain = (next: UnlockState) => {
        submittedPinRef.current = null
        setState(next)
        setPin('')
        setTimeout(() => firstSlotRef.current?.focus(), 0)
      }

      try {
        // A route, not a Server Action: the child's tablet keeps its page open for days, and after a
        // deploy the server no longer knows that page's action ids (parentUnlock.ts).
        const response = await fetch('/next/parent-unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: nextPin }),
        })
        const result = (await response.json()) as UnlockState
        if (result.success) {
          // Unlocked: close the dialog and show the home in the parent view. A page from an older
          // build gets the new one as a full page load (the router does that when the builds differ).
          setState(result)
          setOpen(false)
          setPin('')
          submittedPinRef.current = null
          router.replace('/kodu')
          router.refresh()
        } else {
          tryAgain(result)
        }
      } catch (error) {
        console.error(error)
        // The child's pages work without the network (offline.md); the PIN is checked on the server.
        tryAgain({
          success: false,
          error: navigator.onLine
            ? 'Midagi läks valesti. Palun proovi uuesti.'
            : 'Võrguühendus puudub. Vanema vaatesse saab, kui võrk on tagasi.',
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, router],
  )

  // The fourth digit sends the PIN.
  const handlePinChange = (next: string) => {
    setPin(next)
    if (open && next.length === 4) void submitPin(next)
  }

  // Without a PIN the dialog still opens, to say why the parent view stays shut and where to set
  // one: a greyed-out button said nothing, and nothing else in the child view leads to the profile.
  const handleOpen = () => {
    setState(initialState)
    submittedPinRef.current = null
    setOpen(true)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitPin(pin)
  }

  return (
    <>
      {children ? (
        // custom trigger (ButtonGroup jms jaoks)
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleOpen}
          className={className}
        >
          {children}
        </Button>
      ) : (
        // default ümmargune ikooninupp
        <Button
          variant="secondary"
          roundness="full"
          size="icon"
          onClick={handleOpen}
          aria-label="Vanema vaade"
        >
          <UserLock className="h-6 w-6" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Near the top, above the on-screen keyboard (dialog.tsx). */}
        <DialogContent placement="top">
          <DialogHeader>
            <DialogTitle>Avan vanema vaate</DialogTitle>
          </DialogHeader>

          {hasPin ? (
            <form
              onSubmit={handleSubmit}
              data-navigation-form
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="parent-unlock-pin">PIN (4 numbrit)</Label>
                {/* The link sits beside the boxes, not under the button: the dialog must stay short
                    enough to clear the on-screen keyboard (parent-child-mode.md). The profile's PIN
                    card takes the account password instead of the old PIN. */}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <InputOTP
                    id="parent-unlock-pin"
                    maxLength={4}
                    value={pin}
                    onChange={handlePinChange}
                    containerClassName="justify-start"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} ref={firstSlotRef} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                  <Link
                    href={PIN_SETTINGS_HREF}
                    onClick={() => setOpen(false)}
                    className="inline-flex min-h-9 items-center text-sm text-muted-foreground underline underline-offset-4"
                  >
                    Unustasid PIN-i?
                  </Link>
                </div>
              </div>

              {state.error && (
                <p className="text-sm text-red-500">{state.error}</p>
              )}

              {/* jätame nupu alles fallbackiks / klaviatuurikasutajatele */}
              <Button
                type="submit"
                className="w-full"
                disabled={pin.length !== 4 || isSubmitting}
              >
                {isSubmitting ? 'Avan...' : 'Ava vanema vaade'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sellel kontol pole vanema PIN-i, seega vanema vaadet ei saa avada. Sea profiilis PIN ja ava
                vanema vaade sellega.
              </p>
              <Button asChild className="w-full">
                <Link href={PIN_SETTINGS_HREF} onClick={() => setOpen(false)}>
                  Sea PIN profiilis
                </Link>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
