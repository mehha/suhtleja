'use client'

import { useId, useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ACTION_ERROR, type ActionResult } from '@/utilities/flashToast'

type Props = {
  // A server action that sets `name` to the new value, revalidates the page and returns the outcome.
  action: (formData: FormData) => Promise<ActionResult>
  ariaLabel: string
  checked: boolean
  disabled?: boolean
  // The item's ids, sent with the new value.
  fields: Record<string, string>
  name: string
  stateLabels: { on: string; off: string }
  successMessages: { on: string; off: string }
  // One toast per kind of switch, so quick flips replace it instead of stacking.
  toastId: string
}

// A switch that flips at once and saves in the background. The server's value takes over when
// the action's revalidation arrives; a failed save flips it back and shows an error toast.
export function ActionSwitch({
  action,
  ariaLabel,
  checked,
  disabled,
  fields,
  name,
  stateLabels,
  successMessages,
  toastId,
}: Props) {
  const id = useId()
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(checked)
  const [, startTransition] = useTransition()

  const onCheckedChange = (next: boolean) => {
    startTransition(async () => {
      setOptimisticChecked(next)

      const formData = new FormData()
      for (const [key, value] of Object.entries(fields)) formData.set(key, value)
      formData.set(name, String(next))

      // An error thrown inside the transition would reach the error page.
      let result: ActionResult
      try {
        result = await action(formData)
      } catch (error) {
        console.error('ActionSwitch action failed', error)
        result = { ok: false, error: ACTION_ERROR }
      }

      if (result.ok) {
        toast.success(next ? successMessages.on : successMessages.off, { id: toastId })
      } else {
        toast.error(result.error, { id: toastId })
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        aria-label={ariaLabel}
        checked={optimisticChecked}
        disabled={disabled}
        id={id}
        onCheckedChange={onCheckedChange}
      />
      <Label
        className={
          disabled
            ? 'text-xs font-normal text-muted-foreground'
            : 'cursor-pointer text-xs font-normal text-muted-foreground'
        }
        htmlFor={id}
      >
        {optimisticChecked ? stateLabels.on : stateLabels.off}
      </Label>
    </div>
  )
}
