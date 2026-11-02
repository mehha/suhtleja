import type { ReactNode } from 'react'

// A setting shown, not edited: its name above its value, like the fields in the parent view.
export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="break-words">{children}</div>
    </div>
  )
}
