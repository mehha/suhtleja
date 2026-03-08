import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { QuickChatBoard } from './QuickChatBoard'
import { DEFAULT_QUICK_CHAT_BUTTONS, type QuickChatButton } from './quickChatData'
import { requireActiveMembership } from '@/utilities/membership'
import { MessageCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function QuickChatPage() {
  const { user } = await getCurrentUser()
  if (!user) redirect('/login')
  requireActiveMembership(user)

  const payload = await getPayload({ config: configPromise })

  let buttons: QuickChatButton[] = DEFAULT_QUICK_CHAT_BUTTONS

  try {
    const quickChat = await payload.findGlobal({
      slug: 'quick-chat',
      depth: 0,
    })

    if (quickChat && Array.isArray(quickChat.buttons)) {
      buttons = quickChat.buttons as QuickChatButton[]
    }
  } catch (err) {
    console.warn('Quick chat global missing, using defaults', err)
  }

  return (
    <main className="container space-y-6 py-6">
      <header className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold leading-tight">Kiirsuhtlus</h1>
          <p className="text-sm text-muted-foreground">
            Väga suured nupud kiireks suhtluseks: “Jah”, “Ei”, “Veel”, “Aita”, “Lõpeta”, “Kus on WC?”, “Valus”. Sobib eriti hästi mitteverbaalsetele või madalama oskustasemega lastele.
          </p>
          <ul className="text-xs text-muted-foreground leading-relaxed space-y-1">
            <li>• Kasutatakse iga päev kodus, koolis ja teraapias</li>
            <li>• Sobib igale tasemele, eriti mobiilivaates</li>
            <li>• Ainult paar nuppu, mõju väga suur</li>
          </ul>
        </div>
      </header>

      <QuickChatBoard buttons={buttons} />
    </main>
  )
}
