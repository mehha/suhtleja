// src/components/BoardEditor/CellEditModal.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'

import { getClientSideURL } from '@/utilities/getURL'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

type SymbolItem = {
  id: string
  title: string
  preview: string
  source: 'arasaac' | 'openmoji'
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
  onSaveAction: (
    cellId: string,
    patch: {
      title?: string
      externalImageURL?: string
      h?: number
      image?: string | number | { id: string | number; url?: string } | null
    },
  ) => void
}

type TabKey = 'upload' | 'symbols' | 'media'

export const CellEditModal: React.FC<CellEditModalProps> = ({
  open,
  onOpenChange,
  cell,
  onSaveAction,
}) => {
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null)

  const [tab, setTab] = useState<TabKey>('upload')

  // Symbols
  const [symQ, setSymQ] = useState('')
  const [symSource, setSymSource] = useState<'arasaac' | 'openmoji'>('arasaac')
  const [symLoading, setSymLoading] = useState(false)
  const [symbols, setSymbols] = useState<SymbolItem[]>([])
  const [symError, setSymError] = useState<string | null>(null)

  // Media
  const [mediaQ, setMediaQ] = useState('')
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaItems, setMediaItems] = useState<MediaDoc[]>([])
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [mediaPage, setMediaPage] = useState(1)
  const [mediaTotalPages, setMediaTotalPages] = useState(1)

  // Sünkroniseeri state, kui dialog avaneb
  useEffect(() => {
    if (open && cell) {
      setTitle(cell.title ?? '')
      if (cell.image && typeof cell.image === 'object' && cell.image.url) {
        setUploadedPreview(cell.image.url as string)
      } else if (cell.externalImageURL) {
        setUploadedPreview(cell.externalImageURL)
      } else {
        setUploadedPreview(null)
      }
      // ära muuda taba – kasutaja jääb samasse vaatesse
      // setTab('upload')
    }
  }, [open, cell])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const base = getClientSideURL()
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${base}/api/media`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const json = await res.json()

      if (json?.doc?.id) {
        setUploadedPreview(json.doc.url ?? null)

        // Enam ei muuda pealkirja automaatselt
        // const nameCandidate = json?.doc?.alt || json?.doc?.filename || json?.doc?.url
        // const nextTitle = prettifyName(nameCandidate) || title
        // setTitle(nextTitle)

        if (cell) {
          onSaveAction(cell.id, {
            image: { id: json.doc.id, url: json.doc.url },
            externalImageURL: '',
            // title: nextTitle,
          })
        }
      }
    } catch (e) {
      console.error('Upload failed', e)
    } finally {
      setUploading(false)
    }
  }

  const runSymbolsSearch = async () => {
    if (!symQ.trim()) {
      setSymbols([])
      return
    }
    setSymLoading(true)
    setSymError(null)
    try {
      const base = getClientSideURL()
      const res = await fetch(
        `${base}/next/symbols?q=${encodeURIComponent(
          symQ,
        )}&source=${symSource}&limit=40`,
        { credentials: 'include' },
      )
      if (!res.ok) throw new Error('Symbols load failed')
      const json = await res.json()
      setSymbols(Array.isArray(json.items) ? json.items : [])
    } catch (e) {
      setSymError('Ei õnnestu sümboleid laadida')
      setSymbols([])
    } finally {
      setSymLoading(false)
    }
  }

  const pickSymbol = (s: SymbolItem) => {
    if (!cell) return

    // Enam ei muuda pealkirja automaatselt
    // const nextTitle = prettifyName(s.title || symQ) || title
    setUploadedPreview(s.preview)
    // setTitle(nextTitle)

    onSaveAction(cell.id, {
      externalImageURL: s.preview,
      image: null,
      // title: nextTitle,
    })
  }

  const mediaQueryURL = useMemo(() => {
    const base = getClientSideURL()
    const q = mediaQ.trim()
    const where = q
      ? `&where[or][0][alt][contains]=${encodeURIComponent(
          q,
        )}&where[or][1][filename][contains]=${encodeURIComponent(q)}`
      : ''
    return `${base}/api/media?limit=24&page=${mediaPage}${where}`
  }, [mediaQ, mediaPage])

  const runMediaSearch = async () => {
    setMediaLoading(true)
    setMediaError(null)
    try {
      const res = await fetch(mediaQueryURL, { credentials: 'include' })
      if (!res.ok) throw new Error('Media load failed')
      const json = await res.json()
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
    if (!cell || !m?.id) return
    const url =
      m.sizes?.thumbnail?.url ||
      m.sizes?.small?.url ||
      m.sizes?.medium?.url ||
      m.url
    if (!url) return

    // Enam ei muuda pealkirja automaatselt
    // const nameCandidate = m.alt || m.filename || url
    // const nextTitle = prettifyName(nameCandidate) || title

    setUploadedPreview(url)
    // setTitle(nextTitle)

    onSaveAction(cell.id, {
      image: { id: m.id, url },
      externalImageURL: '',
      // title: nextTitle,
    })
  }

  const handleSave = () => {
    if (!cell) {
      onOpenChange(false)
      return
    }
    onSaveAction(cell.id, { title })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[680px] max-w-[90vw] rounded-2xl p-4 shadow-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Muuda</DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-6">
          {uploadedPreview && (
            <div className="relative aspect-video w-full max-w-64">
              <Image
                src={uploadedPreview}
                alt={title || 'Eelvaade'}
                fill
                className="rounded border object-cover"
                sizes="(min-width: 1024px) 800px, 100vw"
                priority={false}
                unoptimized
              />
            </div>
          )}

          {/* Title */}
          <div className="flex flex-col gap-1 text-sm">
            <Label htmlFor="cell-title" className="text-lg">
              Tekst
            </Label>
            <Input
              id="cell-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="nt. Koer"
            />
          </div>

          {/* Tabs */}
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as TabKey)}
            className="flex flex-col gap-4"
          >
            <TabsList>
              <TabsTrigger value="upload">Lae üles</TabsTrigger>
              <TabsTrigger value="symbols">Sümbolid</TabsTrigger>
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
                  <Input
                    id="cell-symbol-search"
                    value={symQ}
                    placeholder="Otsi sümboleid eesti või inglise keeles… (nt kass, koer, dog, eat, play)"
                    onChange={(e) => setSymQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
                      e.preventDefault()
                      void runSymbolsSearch()
                    }}
                  />
                  <Select
                    value={symSource}
                    onValueChange={(value: 'arasaac' | 'openmoji') =>
                      setSymSource(value)
                    }
                  >
                    <SelectTrigger className="w-[140px] rounded-xl text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arasaac">ARASAAC (et + en)</SelectItem>
                      <SelectItem value="openmoji">OpenMoji</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={runSymbolsSearch}
                  >
                    Otsi
                  </Button>
                </div>

                {symError && (
                  <p className="text-xs text-red-500">{symError}</p>
                )}
                {symLoading ? (
                  <p className="text-xs text-slate-500">Laen…</p>
                ) : symbols.length ? (
                  <div className="grid max-h-48 grid-cols-6 gap-2 overflow-y-auto">
                    {symbols.map((s) => (
                      <Button
                        key={s.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => pickSymbol(s)}
                        className="block overflow-hidden rounded border bg-white p-0 hover:border hover:border-primary focus:outline-none"
                        title={`${s.title} · ${s.source}`}
                      >
                        <Image
                          src={s.preview}
                          alt={s.title}
                          width={64}
                          height={64}
                          className="aspect-video w-full object-contain p-1"
                          loading="lazy"
                          unoptimized
                        />
                        <div className="truncate px-1 pb-1 text-[10px] opacity-70">
                          {s.title}
                        </div>
                      </Button>
                    ))}
                  </div>
                ) : null}

                {!!symbols.length && (
                  <p className="text-[10px] text-slate-400">
                    ARASAAC: CC BY-NC-SA 4.0 · OpenMoji: CC BY-SA 4.0 — avaldamisel
                    lisa allikaviide.
                  </p>
                )}
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
                    <div className="grid max-h-64 grid-cols-6 gap-2 overflow-y-auto">
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
                            size="sm"
                            onClick={() => pickMedia(m)}
                            className="block overflow-hidden rounded border p-0 hover:border hover:border-primary focus:outline-none"
                            title={m.alt || m.filename || ''}
                          >
                            <Image
                              src={thumb}
                              alt={m.alt || ''}
                              width={160}
                              height={80}
                              className="aspect-video w-full object-cover"
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
            <Button type="button" size="sm" variant="outline">
              Tühista
            </Button>
          </DialogClose>
          <Button
            type="button"
            size="sm"
            variant="positive"
            onClick={handleSave}
          >
            Salvesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
