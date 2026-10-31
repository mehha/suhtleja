// src/components/BoardEditor/CellEditModal.tsx
'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Copy, Sparkles } from 'lucide-react'

import { getClientSideURL } from '@/utilities/getURL'
import { cn } from '@/utilities/ui'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

type SymbolSource = 'arasaac' | 'mulberry' | 'openmoji'

type SymbolItem = {
  id: string
  title: string
  preview: string
  source: SymbolSource
  license: string
  attribution?: string
}

type MediaDoc = {
  id: string | number
  url: string
  alt?: string
  filename?: string
  sizes?: Record<string, { url?: string }>
}

type MediaUploadResponse = {
  doc?: {
    id?: string | number
    url?: string | null
  }
}

type SymbolsResponse = {
  aiTerms?: string[]
  items?: SymbolItem[]
}

type MediaSearchResponse = {
  docs?: MediaDoc[]
  totalPages?: number
}

type GenerateResponse = {
  error?: string
  images?: string[]
  limit?: number
  remaining?: number
}

type CellImagePatch = {
  title?: string
  externalImageURL?: string
  h?: number
  image?: string | number | { id: string | number; url?: string } | null
}

type CellEditModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cell:
    | {
        id: string
        title?: string | null
        externalImageURL?: string | null
        h?: number | null
        image?: any
      }
    | null
  onSaveAction: (cellId: string, patch: CellImagePatch) => void
}

type TabKey = 'symbols' | 'generate' | 'upload' | 'media'

// The picture the user chose in this dialog. It replaces the card's picture only on "Salvesta".
type PendingImage =
  | { kind: 'external'; url: string }
  | { kind: 'media'; id: string | number; url: string }
  | { kind: 'generated'; dataURL: string }

const SYMBOL_SEARCH_DELAY_MS = 400

const GENERATE_ERRORS: Record<string, string> = {
  ai_unavailable: 'AI-pildid pole praegu saadaval.',
  label_too_long: 'Kirjelda pilti lühemalt (kuni 80 märki).',
  limit_reached: 'Selle kuu AI-piltide limiit on täis.',
}

function pendingImageSrc(pending: PendingImage): string {
  return pending.kind === 'generated' ? pending.dataURL : pending.url
}

function dataURLToFile(dataURL: string, name: string): File {
  const [header = '', base64 = ''] = dataURL.split(',')
  const mimeType = /data:([^;]+);/.exec(header)?.[1] ?? 'image/jpeg'
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  const extension = mimeType.split('/')[1] ?? 'jpg'
  const baseName =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '') || 'pilt'

  return new File([bytes], `ai-${baseName}.${extension}`, { type: mimeType })
}

async function uploadMedia(file: File, alt?: string) {
  const formData = new FormData()
  formData.append('file', file)
  if (alt) formData.append('_payload', JSON.stringify({ alt }))

  const res = await fetch(`${getClientSideURL()}/api/media`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  const json = res.ok ? ((await res.json()) as MediaUploadResponse) : null

  if (!json?.doc?.id) {
    console.error('Upload failed', res.status)
    return null
  }

  return { id: json.doc.id, url: json.doc.url ?? undefined }
}

export const CellEditModal: React.FC<CellEditModalProps> = ({
  open,
  onOpenChange,
  cell,
  onSaveAction,
}) => {
  const [title, setTitle] = useState('')
  const [pending, setPending] = useState<PendingImage | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [tab, setTab] = useState<TabKey>('symbols')

  // Symbols
  const [symQ, setSymQ] = useState('')
  const [symSource, setSymSource] = useState<SymbolSource>('arasaac')
  const [symLoading, setSymLoading] = useState(false)
  const [symbols, setSymbols] = useState<SymbolItem[]>([])
  const [symAiTerms, setSymAiTerms] = useState<string[]>([])
  const [symError, setSymError] = useState<string | null>(null)
  const [symSearchedKey, setSymSearchedKey] = useState<string | null>(null)

  // AI generation
  const [genLabel, setGenLabel] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [genImages, setGenImages] = useState<string[]>([])
  const [genError, setGenError] = useState<string | null>(null)
  const [genQuota, setGenQuota] = useState<{ limit: number; remaining: number } | null>(null)

  // Media
  const [mediaQ, setMediaQ] = useState('')
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaItems, setMediaItems] = useState<MediaDoc[]>([])
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [mediaPage, setMediaPage] = useState(1)
  const [mediaTotalPages, setMediaTotalPages] = useState(1)
  const initializedCellIdRef = useRef<string | null>(null)

  const currentImageSrc =
    (cell?.image && typeof cell.image === 'object' && (cell.image.url as string)) ||
    cell?.externalImageURL ||
    null
  const previewSrc = pending ? pendingImageSrc(pending) : currentImageSrc
  const selectedSrc = pending ? pendingImageSrc(pending) : currentImageSrc

  // Sünkroniseeri state, kui dialog avaneb
  useEffect(() => {
    if (!open || !cell) {
      initializedCellIdRef.current = null
      return
    }
    if (initializedCellIdRef.current === cell.id) return
    initializedCellIdRef.current = cell.id

    const cellTitle = cell.title ?? ''
    setTitle(cellTitle)
    setPending(null)
    setSymQ(cellTitle)
    setSymbols([])
    setSymAiTerms([])
    setSymError(null)
    setSymSearchedKey(null)
    setGenLabel(cellTitle)
    setGenImages([])
    setGenError(null)
    setTab('symbols')
  }, [open, cell])

  // Search while typing, starting with the card's own text when the dialog opens.
  const hasSymbolQuery = symQ.trim().length > 0
  const symSearchKey = `${symSource}:${symQ.trim()}`
  useEffect(() => {
    if (!open || tab !== 'symbols') return
    const q = symQ.trim()
    // An empty query shows nothing (see hasSymbolQuery); there is nothing to fetch.
    if (!q || symSearchedKey === symSearchKey) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSymLoading(true)
      setSymError(null)
      try {
        const params = new URLSearchParams({
          aiFallback: 'true',
          limit: '40',
          q,
          source: symSource,
        })
        const res = await fetch(`${getClientSideURL()}/next/symbols?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Symbols load failed')
        const json = (await res.json()) as SymbolsResponse
        setSymbols(Array.isArray(json.items) ? json.items : [])
        setSymAiTerms(Array.isArray(json.aiTerms) ? json.aiTerms : [])
        setSymSearchedKey(symSearchKey)
      } catch {
        if (controller.signal.aborted) return
        setSymError('Ei õnnestu sümboleid laadida')
        setSymbols([])
        setSymAiTerms([])
      } finally {
        if (!controller.signal.aborted) setSymLoading(false)
      }
    }, SYMBOL_SEARCH_DELAY_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, tab, symQ, symSource, symSearchKey, symSearchedKey])

  // How many generations are left this month, once the tab is opened.
  useEffect(() => {
    if (!open || tab !== 'generate' || genQuota) return
    const controller = new AbortController()
    fetch(`${getClientSideURL()}/next/symbol-generate`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<GenerateResponse>) : null))
      .then((json) => {
        if (typeof json?.limit === 'number' && typeof json.remaining === 'number') {
          setGenQuota({ limit: json.limit, remaining: json.remaining })
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [open, tab, genQuota])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const media = await uploadMedia(file)
      if (!media) {
        toast.error('Pildi üleslaadimine ebaõnnestus.')
        return
      }
      setPending({ kind: 'media', id: media.id, url: media.url ?? '' })
    } catch (e) {
      console.error('Upload failed', e)
      toast.error('Pildi üleslaadimine ebaõnnestus.')
    } finally {
      setUploading(false)
    }
  }

  const runGenerate = async () => {
    const label = genLabel.trim()
    if (!label || genLoading) return

    setGenLoading(true)
    setGenError(null)
    try {
      const res = await fetch(`${getClientSideURL()}/next/symbol-generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      })
      const json = (await res.json().catch(() => ({}))) as GenerateResponse

      if (typeof json.limit === 'number' && typeof json.remaining === 'number') {
        setGenQuota({ limit: json.limit, remaining: json.remaining })
      }

      if (!res.ok || !json.images?.length) {
        setGenError(
          (json.error && GENERATE_ERRORS[json.error]) ||
            'Pildi loomine ebaõnnestus. Proovi uuesti.',
        )
        return
      }

      setGenImages(json.images)
    } catch {
      setGenError('Pildi loomine ebaõnnestus. Proovi uuesti.')
    } finally {
      setGenLoading(false)
    }
  }

  const openGenerate = () => {
    setGenLabel(symQ.trim() || title)
    setTab('generate')
  }

  const mediaQueryURL = useMemo(() => {
    const base = getClientSideURL()
    const q = mediaQ.trim()
    const params = new URLSearchParams({
      limit: '24',
      page: String(mediaPage),
      'where[and][0][folder][exists]': 'true',
      'where[and][1][mimeType][contains]': 'image',
    })

    if (q) {
      params.set('where[and][2][or][0][alt][contains]', q)
      params.set('where[and][2][or][1][filename][contains]', q)
    }

    return `${base}/api/media?${params.toString()}`
  }, [mediaQ, mediaPage])

  const runMediaSearch = async () => {
    setMediaLoading(true)
    setMediaError(null)
    try {
      const res = await fetch(mediaQueryURL, { credentials: 'include' })
      if (!res.ok) throw new Error('Media load failed')
      const json = (await res.json()) as MediaSearchResponse
      const docs: MediaDoc[] = Array.isArray(json?.docs) ? json.docs : []
      setMediaItems(docs)
      if (typeof json?.totalPages === 'number') {
        setMediaTotalPages(json.totalPages)
      }
    } catch (e) {
      setMediaItems([])
      setMediaError('Ei õnnestu meediumit laadida')
    } finally {
      setMediaLoading(false)
    }
  }

  useEffect(() => {
    if (open && tab === 'media') setMediaPage(1)
  }, [open, tab])

  useEffect(() => {
    if (tab !== 'media') return
    const delay = mediaQ.trim() ? 300 : 0
    const t = setTimeout(() => {
      void runMediaSearch()
    }, delay)
    return () => clearTimeout(t)
  }, [tab, mediaQueryURL, mediaQ])

  const pickMedia = (m: MediaDoc) => {
    if (!m?.id) return
    const url =
      m.sizes?.thumbnail?.url ||
      m.sizes?.small?.url ||
      m.sizes?.medium?.url ||
      m.url
    if (!url) return

    setPending({ kind: 'media', id: m.id, url })
  }

  const handleSave = async () => {
    if (!cell) {
      onOpenChange(false)
      return
    }

    const patch: CellImagePatch = { title }

    if (pending?.kind === 'external') {
      patch.externalImageURL = pending.url
      patch.image = null
    } else if (pending?.kind === 'media') {
      patch.image = { id: pending.id, url: pending.url }
      patch.externalImageURL = ''
    } else if (pending?.kind === 'generated') {
      setSaving(true)
      try {
        const media = await uploadMedia(
          dataURLToFile(pending.dataURL, title || genLabel),
          title || genLabel,
        )
        if (!media) {
          toast.error('AI-pildi salvestamine ebaõnnestus.')
          return
        }
        patch.image = media
        patch.externalImageURL = ''
      } catch (e) {
        console.error('Saving the generated image failed', e)
        toast.error('AI-pildi salvestamine ebaõnnestus.')
        return
      } finally {
        setSaving(false)
      }
    }

    onSaveAction(cell.id, patch)
    onOpenChange(false)
  }

  const imageButtonClass = (src: string) =>
    cn(
      'relative block aspect-square h-auto overflow-hidden rounded-lg border bg-white p-0 hover:border-primary focus:outline-none',
      selectedSrc === src && 'border-primary ring-2 ring-primary',
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[720px] max-w-[94vw] overflow-y-auto rounded-2xl p-4 shadow-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Muuda</DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-6">
          <div className="flex items-end gap-4">
            {previewSrc && (
              <div className="relative aspect-square w-28 shrink-0 rounded-lg border bg-white">
                <Image
                  src={previewSrc}
                  alt={title || 'Eelvaade'}
                  fill
                  className="rounded-lg object-contain p-2"
                  sizes="112px"
                  priority={false}
                  unoptimized
                />
              </div>
            )}

            {/* Title */}
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <Label htmlFor="cell-title" className="text-lg">
                Tekst
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="cell-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="nt. Koer"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setSymQ(title)}
                  disabled={tab !== 'symbols' || !title.trim()}
                  title="Kopeeri tekst sümbolite otsingusse"
                  aria-label="Kopeeri tekst sümbolite otsingusse"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as TabKey)}
            className="flex flex-col gap-4"
          >
            <TabsList>
              <TabsTrigger value="symbols">Sümbolid</TabsTrigger>
              <TabsTrigger value="generate">AI-pilt</TabsTrigger>
              <TabsTrigger value="upload">Lae üles</TabsTrigger>
              <TabsTrigger value="media">Meedia</TabsTrigger>
            </TabsList>

            {/* Upload */}
            <TabsContent value="upload">
              <div className="flex flex-col gap-1 text-sm">
                <Label htmlFor="cell-image-upload" className="text-sm">
                  Lae pilt üles
                </Label>
                <Input
                  id="cell-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleUpload(file)
                  }}
                  disabled={uploading}
                  className="cursor-pointer text-sm"
                />
                {uploading && (
                  <p className="text-xs text-slate-500">Laen üles…</p>
                )}
              </div>
            </TabsContent>

            {/* Symbols */}
            <TabsContent value="symbols">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Input
                      id="cell-symbol-search"
                      value={symQ}
                      placeholder="Otsi sümboleid eesti või inglise keeles… (nt kass, koer, dog, eat, play)"
                      onChange={(e) => setSymQ(e.target.value)}
                      onKeyDown={(e) => {
                        // Search runs while typing; Enter must not submit or close anything.
                        if (e.key === 'Enter') e.preventDefault()
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setTitle(symQ)}
                      disabled={tab !== 'symbols' || !symQ.trim()}
                      title="Kopeeri sümbolite otsing tekstiväljale"
                      aria-label="Kopeeri sümbolite otsing tekstiväljale"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Select
                    value={symSource}
                    onValueChange={(value: SymbolSource) => setSymSource(value)}
                  >
                    <SelectTrigger className="w-[170px] rounded-xl text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arasaac">ARASAAC (et + en)</SelectItem>
                      <SelectItem value="mulberry">Mulberry (en)</SelectItem>
                      <SelectItem value="openmoji">OpenMoji</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {hasSymbolQuery && symError && (
                  <p className="text-xs text-red-500">{symError}</p>
                )}
                {!hasSymbolQuery ? null : symLoading ? (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Spinner /> Otsin…
                  </p>
                ) : symbols.length ? (
                  <>
                    {symAiTerms.length > 0 && (
                      <p className="text-xs text-slate-500">
                        Otsest vastet ei olnud, AI otsis: {symAiTerms.join(', ')}
                      </p>
                    )}
                    <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-6">
                      {symbols.map((s) => (
                        <Button
                          key={s.id}
                          type="button"
                          variant="outline"
                          onClick={() => setPending({ kind: 'external', url: s.preview })}
                          className={cn(imageButtonClass(s.preview), 'flex flex-col')}
                          title={`${s.title} · ${s.source}`}
                          aria-pressed={selectedSrc === s.preview}
                        >
                          <span className="relative w-full flex-1">
                            <Image
                              src={s.preview}
                              alt={s.title}
                              fill
                              sizes="96px"
                              className="object-contain p-1"
                              loading="lazy"
                              unoptimized
                            />
                          </span>
                          <span className="w-full truncate px-1 pb-1 text-[10px] font-normal opacity-70">
                            {s.title}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </>
                ) : symSearchedKey === symSearchKey && !symError ? (
                  <p className="text-sm text-slate-500">Sobivat pilti ei leitud.</p>
                ) : null}

                {hasSymbolQuery &&
                  (symbols.length > 0 || symSearchedKey === symSearchKey) &&
                  !symLoading && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] text-slate-400">
                      ARASAAC: CC BY-NC-SA 4.0 · Mulberry: CC BY-SA 4.0 · OpenMoji: CC BY-SA 4.0
                    </p>
                    <Button type="button" size="sm" variant="outline" onClick={openGenerate}>
                      <Sparkles className="h-4 w-4" />
                      Ei leidnud sobivat? Loo AI-ga
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* AI generation */}
            <TabsContent value="generate">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={genLabel}
                    maxLength={80}
                    onChange={(e) => setGenLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
                      e.preventDefault()
                      void runGenerate()
                    }}
                    className="min-w-0 flex-1"
                    placeholder="Mida pilt näitab? nt koer, jooma, veel"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={runGenerate}
                    disabled={genLoading || !genLabel.trim() || genQuota?.remaining === 0}
                  >
                    {genLoading ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                    Loo pildid
                  </Button>
                </div>

                <p className="text-xs text-slate-500">
                  AI loob 4 pilti ühtses piktogrammi stiilis. Valitud pilt salvestub sinu meediasse,
                  kui vajutad „Salvesta“.
                  {genQuota && ` Sel kuul alles ${genQuota.remaining}/${genQuota.limit} korda.`}
                </p>

                {genError && <p className="text-xs text-red-500">{genError}</p>}

                {genLoading ? (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Spinner /> Loon pilte… see võtab mõne sekundi.
                  </p>
                ) : genImages.length ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {genImages.map((src, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant="outline"
                        onClick={() => setPending({ kind: 'generated', dataURL: src })}
                        className={imageButtonClass(src)}
                        aria-label={`AI-pilt ${index + 1}`}
                        aria-pressed={selectedSrc === src}
                      >
                        <Image
                          src={src}
                          alt={`AI-pilt ${index + 1}: ${genLabel}`}
                          fill
                          sizes="160px"
                          className="object-contain"
                          unoptimized
                        />
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </TabsContent>

            {/* Media */}
            <TabsContent value="media">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={mediaQ}
                    onChange={(e) => setMediaQ(e.target.value)}
                    className="flex-1"
                    placeholder="Otsi meediumist… (alt või failinimi) — jäta tühjaks, et näha viimaseid"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setMediaPage(1)}
                    title="Otsi"
                  >
                    Otsi
                  </Button>
                </div>

                {mediaError && (
                  <p className="text-xs text-red-500">{mediaError}</p>
                )}
                {mediaLoading ? (
                  <p className="text-xs text-slate-500">Laen…</p>
                ) : mediaItems.length ? (
                  <>
                    <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-6">
                      {mediaItems.map((m) => {
                        const thumb =
                          m.sizes?.thumbnail?.url ||
                          m.sizes?.small?.url ||
                          m.sizes?.medium?.url ||
                          m.url
                        if (!thumb) return null
                        return (
                          <Button
                            key={String(m.id)}
                            type="button"
                            variant="outline"
                            onClick={() => pickMedia(m)}
                            className={imageButtonClass(thumb)}
                            title={m.alt || m.filename || ''}
                            aria-pressed={selectedSrc === thumb}
                          >
                            <Image
                              src={thumb}
                              alt={m.alt || ''}
                              fill
                              sizes="96px"
                              className="object-contain p-1"
                              loading="lazy"
                              unoptimized
                            />
                          </Button>
                        )
                      })}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        Leht {mediaPage} / {mediaTotalPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={mediaPage <= 1}
                          onClick={() =>
                            setMediaPage((p) => Math.max(1, p - 1))
                          }
                        >
                          Eelmine
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={mediaPage >= mediaTotalPages}
                          onClick={() => setMediaPage((p) => p + 1)}
                        >
                          Järgmine
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Tulemusi pole.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" size="sm" variant="outline" disabled={saving}>
              Tühista
            </Button>
          </DialogClose>
          <Button
            type="button"
            size="sm"
            variant="positive"
            onClick={handleSave}
            disabled={saving || uploading}
          >
            {saving && <Spinner />}
            Salvesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
