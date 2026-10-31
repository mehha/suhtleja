import { cn } from '@/utilities/ui'
import * as React from 'react'

const Textarea: React.FC<
  {
    ref?: React.Ref<HTMLTextAreaElement>
  } & React.TextareaHTMLAttributes<HTMLTextAreaElement>
> = ({ className, ref, ...props }) => {
  return (
    <textarea
      className={cn(
        // 16px text on touch screens: iPhone Safari zooms the page in to a field with smaller text.
        'flex min-h-[80px] w-full rounded border border-border bg-background px-3 py-2 text-base ring-offset-background [@media(pointer:fine)]:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
}

export { Textarea }
