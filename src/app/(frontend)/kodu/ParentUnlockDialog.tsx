'use client'

import React, { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { unlockParentModeAction, type UnlockState } from './modeActions'
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
import { cn } from '@/utilities/ui'

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
  const [state, formAction] = useActionState(unlockParentModeAction, initialState)
  const router = useRouter()
  const formRef = useRef<HTMLFormElement | null>(null)

  // ref esimesele OTP slotile
  const firstSlotRef = useRef<HTMLInputElement | null>(null)

  // edu korral: sulge dialog ja refres-hi koduvaade
  useEffect(() => {
    if (state.success) {
      setOpen(false)
      setPin('')
      router.push('/kodu')
    }
  }, [state.success, router])

  // kui sisestatud 4 numbrit → automaatne submit
  useEffect(() => {
    if (open && pin.length === 4 && formRef.current) {
      formRef.current.requestSubmit()
    }
  }, [pin, open])

  // VALE PIN: tühjenda ja liiguta fookus algusesse
  useEffect(() => {
    if (!state.success && state.error) {
      setPin('')
      // väike viivitus, et DOM jõuaks uuenduda
      setTimeout(() => {
        firstSlotRef.current?.focus()
      }, 0)
    }
  }, [state])

  const handleOpen = () => {
    if (!hasPin) return
    setOpen(true)
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
          disabled={!hasPin}
          className={cn(className, !hasPin && 'cursor-not-allowed opacity-60')}
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
          disabled={!hasPin}
        >
          <UserLock className="h-6 w-6" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avan vanema vaate</DialogTitle>
          </DialogHeader>

          <form
            ref={formRef}
            action={formAction}
            data-navigation-form
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>PIN (4 numbrit)</Label>
              <InputOTP
                maxLength={4}
                value={pin}
                onChange={setPin}
                containerClassName="justify-start"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} ref={firstSlotRef} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
              <input type="hidden" name="pin" value={pin} />
            </div>

            {state.error && (
              <p className="text-sm text-red-500">{state.error}</p>
            )}

            {/* jätame nupu alles fallbackiks / klaviatuurikasutajatele */}
            <Button
              type="submit"
              className="w-full"
              disabled={pin.length !== 4}
            >
              Ava vanema vaade
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
