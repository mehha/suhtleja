'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

// Many parents use an iPad without a mail app set up, so the address can be copied too.
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
          })
          .catch(() => setCopied(false))
      }}
      className="inline-flex min-h-10 items-center gap-2 rounded-full border-2 border-[#d8dde8] bg-white px-4 text-sm font-semibold text-[#22314c] transition hover:border-[#22314c]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1c79dd] focus-visible:ring-offset-2"
    >
      {copied ? <Check aria-hidden="true" className="h-4 w-4 text-[#19724f]" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
      <span aria-live="polite">{copied ? 'Kopeeritud' : 'Kopeeri aadress'}</span>
    </button>
  )
}
