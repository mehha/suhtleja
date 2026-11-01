// src/components/BoardEditor/CellEditModal.tsx
'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, Copy, LayoutGrid, Sparkles, Upload } from 'lucide-react'

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
  WORD_CLASSES,
  WORD_CLASS_INFO,
  isWordClass,
  normalizeWord,
  type WordClass,
} from '@/utilities/wordClass'
import { nounPartitive, placeFormsOf, verbCard, verbForm } from '@/utilities/grammar/applyGrammar'

type SymbolBank = 'arasaac' | 'mulberry' | 'openmoji'

type SearchScope = 'all' | 'mine' | 'library' | SymbolBank

type PictureItem = {
  id: string
  title: string
  preview: string
  source: 'mine' | 'library' | SymbolBank
  mediaId?: number
}

// One symbol bank's group. `aiTerms`: the word itself found nothing, these English terms did.
type BankResult = {
  aiTerms?: string[]
  bank: SymbolBank
  items: PictureItem[]
}

// A picture bank category (/next/picture-bank): a library folder with a cover picture.
type BankCategory = {
  count: number
  cover: string | null
  id: number
  name: string
}

type SearchResults = {
  banks: BankResult[]
  library: PictureItem[]
  mine: PictureItem[]
}

type MediaUploadResponse = {
  doc?: {
    id?: string | number
    url?: string | null
  }
}

type GenerateResponse = {
  error?: string
  generationId?: number
  images?: string[]
  limit?: number
  personal?: boolean
  remaining?: number
}

type SaveGeneratedResponse = {
  error?: string
  media?: { id: number; url: string | null }
  shared?: boolean
}

type CellImagePatch = {
  title?: string
  wordClass?: WordClass | null
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
        wordClass?: string | null
      }
    | null
  onSaveAction: (cellId: string, patch: CellImagePatch) => void
  // The board's word forms (extra.grammar): the dialog shows a verb card's forms.
  grammar?: boolean
}

// Where the card's word class came from: saved on the card, suggested from its text in this dialog
// (/next/word-class), or picked by the parent, after which the text no longer changes it.
type WordClassSource = 'saved' | 'auto' | 'manual'

// The picture the user chose in this dialog. It replaces the card's picture only on "Salvesta".
type PendingImage =
  | { kind: 'external'; url: string }
  | { kind: 'media'; id: string | number; url: string }
  | { kind: 'generated'; dataURL: string; generationId: number }

const SEARCH_DELAY_MS = 350

const EMPTY_RESULTS: SearchResults = { banks: [], library: [], mine: [] }

// The word class select's value for a card without a class (Radix Select has no empty value).
const NO_WORD_CLASS = 'none'

const SCOPE_LABELS: Record<SearchScope, string> = {
  all: 'Kõik allikad',
  mine: 'Minu pildid',
  library: 'Suhtleja kogu',
  arasaac: 'ARASAAC',
  mulberry: 'Mulberry',
  openmoji: 'OpenMoji (emojid)',
}

const BANK_HEADINGS: Record<SymbolBank, string> = {
  arasaac: 'ARASAAC',
  mulberry: 'Mulberry',
  openmoji: 'OpenMoji',
}

const BANK_LICENSES: Record<SymbolBank, string> = {
  arasaac: 'ARASAAC: CC BY-NC-SA 4.0',
  mulberry: 'Mulberry: CC BY-SA 4.0',
  openmoji: 'OpenMoji: CC BY-SA 4.0',
}

function parseBankResults(value: unknown): BankResult[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (result): result is BankResult =>
      Boolean(result) &&
      typeof result.bank === 'string' &&
      result.bank in BANK_HEADINGS &&
      Array.isArray(result.items),
  )
}

const GENERATE_ERRORS: Record<string, string> = {
  ai_unavailable: 'AI-pildid pole praegu saadaval.',
  label_too_long: 'Kirjelda pilti lühemalt (kuni 80 märki).',
  limit_reached: 'Selle kuu AI-piltide limiit on täis.',
}

function pendingImageSrc(pending: PendingImage): string {
  return pending.kind === 'generated' ? pending.dataURL : pending.url
}

async function uploadMedia(file: File) {
  const formData = new FormData()
  formData.append('file', file)

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

  return { id: json.doc.id, url: json.doc.url ?? '' }
}

export const CellEditModal: React.FC<CellEditModalProps> = ({
  open,
  onOpenChange,
  cell,
  onSaveAction,
  grammar = true,
}) => {
  const [title, setTitle] = useState('')
  const [pending, setPending] = useState<PendingImage | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Word class
  const [wordClass, setWordClass] = useState<WordClass | null>(null)
  const [wordClassSource, setWordClassSource] = useState<WordClassSource>('auto')
  const [classLookedUpFor, setClassLookedUpFor] = useState<string | null>(null)
  const wordClassSourceRef = useRef<WordClassSource>('auto')

  // What the board's word forms make of a verb, place or noun card, or that they leave a verb as it is.
  const verbFormsHint = useMemo(() => {
    if (!grammar || !title.trim()) return null
    const card = verbCard(title, wordClass)
    if (card) {
      return `Lauses: mina ${verbForm(card, '1sg')} · tema ${verbForm(card, '3sg')} · ei ${verbForm(card, 'neg')}`
    }
    const place = placeFormsOf(title, wordClass)
    if (place) return `Lauses: lähen ${place.to} · olen ${place.at}`
    const partitive = nounPartitive(title, wordClass)
    if (partitive) return `Lauses: tahan ${partitive} · kaks ${partitive}`
    const unknownVerb = wordClass === 'verb' && /ma$/.test(normalizeWord(title))
    return unknownVerb ? 'Seda tegusõna Suhtleja veel ei pööra. Vajadusel tee sõnaühend.' : null
  }, [grammar, title, wordClass])

  // Search
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchedKey, setSearchedKey] = useState<string | null>(null)

  // AI generation
  const [showGenerate, setShowGenerate] = useState(false)
  const [genLabel, setGenLabel] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [genImages, setGenImages] = useState<string[]>([])
  const [genGenerationId, setGenGenerationId] = useState<number | null>(null)
  const [genPersonal, setGenPersonal] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [genQuota, setGenQuota] = useState<{ limit: number; remaining: number } | null>(null)

  // Picture bank: its categories show while the search is empty.
  const [bankCategories, setBankCategories] = useState<BankCategory[] | null>(null)
  const [bankFolder, setBankFolder] = useState<{ id: number; name: string } | null>(null)
  const [bankPictures, setBankPictures] = useState<{ folderId: number; items: PictureItem[] } | null>(null)
  const [bankError, setBankError] = useState<string | null>(null)

  const initializedCellIdRef = useRef<string | null>(null)

  const currentImageSrc =
    (cell?.image && typeof cell.image === 'object' && (cell.image.url as string)) ||
    cell?.externalImageURL ||
    null
  const previewSrc = pending ? pendingImageSrc(pending) : currentImageSrc
  const selectedSrc = previewSrc

  // Sünkroniseeri state, kui dialog avaneb
  useEffect(() => {
    if (!open || !cell) {
      initializedCellIdRef.current = null
      return
    }
    if (initializedCellIdRef.current === cell.id) return
    initializedCellIdRef.current = cell.id

    const cellTitle = cell.title ?? ''
    const savedClass = isWordClass(cell.wordClass) ? cell.wordClass : null
    setTitle(cellTitle)
    setWordClass(savedClass)
    setWordClassSource(savedClass ? 'saved' : 'auto')
    // A saved class stands until the text changes; a card without one gets a suggestion at once.
    setClassLookedUpFor(savedClass ? normalizeWord(cellTitle) : null)
    setPending(null)
    setQuery(cellTitle)
    setResults(EMPTY_RESULTS)
    setSearchError(null)
    setSearchedKey(null)
    setShowGenerate(false)
    setGenLabel(cellTitle)
    setGenImages([])
    setGenGenerationId(null)
    setGenError(null)
    setBankFolder(null)
    setBankError(null)
  }, [open, cell])

  useEffect(() => {
    wordClassSourceRef.current = wordClassSource
  }, [wordClassSource])

  // The word class follows the text until the parent picks one: a known word gets its class, an
  // unknown one clears a suggestion but keeps a class saved on the card.
  useEffect(() => {
    if (!open || wordClassSource === 'manual') return
    const word = normalizeWord(title)
    if (word === classLookedUpFor) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      if (!word) {
        setClassLookedUpFor(word)
        if (wordClassSourceRef.current === 'auto') setWordClass(null)
        return
      }
      try {
        const res = await fetch(
          `${getClientSideURL()}/next/word-class?${new URLSearchParams({ word }).toString()}`,
          { credentials: 'include', signal: controller.signal },
        )
        const json = res.ok ? ((await res.json()) as { classes?: Record<string, unknown> }) : null
        if (controller.signal.aborted || wordClassSourceRef.current === 'manual') return
        setClassLookedUpFor(word)
        const suggested = json?.classes?.[word]
        if (isWordClass(suggested)) {
          setWordClass(suggested)
          setWordClassSource('auto')
        } else if (wordClassSourceRef.current === 'auto') {
          setWordClass(null)
        }
      } catch {
        // No suggestion; the parent can still pick a class.
      }
    }, SEARCH_DELAY_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, title, classLookedUpFor, wordClassSource])

  // One search over the member's own pictures, the shared library and the symbol banks. It starts with
  // the card's text and runs while typing; an empty query lists the newest pictures.
  const searchKey = `${scope}:${query.trim()}`
  useEffect(() => {
    if (!open || searchedKey === searchKey) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      setSearchError(null)
      try {
        const params = new URLSearchParams({ q: query.trim(), scope })
        const res = await fetch(`${getClientSideURL()}/next/image-search?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Image search failed')
        const json = (await res.json()) as Partial<Record<keyof SearchResults, unknown>>
        setResults({
          banks: parseBankResults(json.banks),
          library: Array.isArray(json.library) ? json.library : [],
          mine: Array.isArray(json.mine) ? json.mine : [],
        })
        setSearchedKey(searchKey)
      } catch {
        if (controller.signal.aborted) return
        setSearchError('Ei õnnestu pilte laadida')
        setResults(EMPTY_RESULTS)
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, SEARCH_DELAY_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, query, scope, searchKey, searchedKey])

  // How many generations are left this month, once the AI panel is opened.
  useEffect(() => {
    if (!open || !showGenerate || genQuota) return
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
  }, [open, showGenerate, genQuota])

  // The picture bank's categories, once per page load.
  useEffect(() => {
    if (!open || bankCategories) return
    const controller = new AbortController()
    fetch(`${getClientSideURL()}/next/picture-bank`, { credentials: 'include', signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ categories?: BankCategory[] }>) : null))
      .then((json) => setBankCategories(Array.isArray(json?.categories) ? json.categories : []))
      .catch(() => {})
    return () => controller.abort()
  }, [open, bankCategories])

  // The pictures of the category being browsed.
  useEffect(() => {
    if (!open || !bankFolder || bankPictures?.folderId === bankFolder.id) return
    const controller = new AbortController()
    const folderId = bankFolder.id
    fetch(`${getClientSideURL()}/next/picture-bank?folder=${folderId}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ pictures?: PictureItem[] }>) : Promise.reject()))
      .then((json) => {
        setBankError(null)
        setBankPictures({ folderId, items: Array.isArray(json.pictures) ? json.pictures : [] })
      })
      .catch(() => {
        if (!controller.signal.aborted) setBankError('Ei õnnestu pilte laadida')
      })
    return () => controller.abort()
  }, [open, bankFolder, bankPictures])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const media = await uploadMedia(file)
      if (!media) {
        toast.error('Pildi üleslaadimine ebaõnnestus.')
        return
      }
      setPending({ kind: 'media', id: media.id, url: media.url })
      // The upload is one of "Minu pildid" now.
      setSearchedKey(null)
    } catch (e) {
      console.error('Upload failed', e)
      toast.error('Pildi üleslaadimine ebaõnnestus.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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

      if (!res.ok || !json.images?.length || typeof json.generationId !== 'number') {
        setGenError(
          (json.error && GENERATE_ERRORS[json.error]) ||
            'Pildi loomine ebaõnnestus. Proovi uuesti.',
        )
        return
      }

      setGenImages(json.images)
      setGenGenerationId(json.generationId)
      setGenPersonal(Boolean(json.personal))
    } catch {
      setGenError('Pildi loomine ebaõnnestus. Proovi uuesti.')
    } finally {
      setGenLoading(false)
    }
  }

  const openBank = () => {
    setQuery('')
    setBankFolder(null)
    setBankError(null)
    if (scope !== 'all' && scope !== 'library') setScope('all')
  }

  const openGenerate = () => {
    setGenLabel(query.trim() || title)
    setShowGenerate(true)
  }

  const pickItem = (item: PictureItem) => {
    // A card without text would say nothing: give it the picture's word.
    if (!title.trim() && item.title) setTitle(item.title)
    if (typeof item.mediaId === 'number') {
      setPending({ kind: 'media', id: item.mediaId, url: item.preview })
    } else {
      setPending({ kind: 'external', url: item.preview })
    }
  }

  const handleSave = async () => {
    if (!cell) {
      onOpenChange(false)
      return
    }

    const patch: CellImagePatch = { title, wordClass }

    if (pending?.kind === 'external') {
      patch.externalImageURL = pending.url
      patch.image = null
    } else if (pending?.kind === 'media') {
      patch.image = { id: pending.id, url: pending.url }
      patch.externalImageURL = ''
    } else if (pending?.kind === 'generated') {
      setSaving(true)
      try {
        const res = await fetch(`${getClientSideURL()}/next/symbol-generate/save`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ generationId: pending.generationId, image: pending.dataURL }),
        })
        const json = (await res.json().catch(() => ({}))) as SaveGeneratedResponse
        if (!res.ok || !json.media?.id) {
          toast.error('AI-pildi salvestamine ebaõnnestus.')
          return
        }
        patch.image = { id: json.media.id, url: json.media.url ?? undefined }
        patch.externalImageURL = ''
        if (json.shared) {
          toast.success('AI-pilt lisati ka Suhtleja ühisesse kogusse.')
        }
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

  const tileClass = (src: string) =>
    cn(
      'relative flex aspect-square h-auto flex-col overflow-hidden rounded-lg border bg-white p-0 hover:border-primary focus:outline-none',
      selectedSrc === src && 'border-primary ring-2 ring-primary',
    )

  const renderTiles = (items: PictureItem[]) => (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="outline"
          onClick={() => pickItem(item)}
          className={tileClass(item.preview)}
          title={item.title}
          aria-pressed={selectedSrc === item.preview}
        >
          <span className="relative w-full flex-1">
            <Image
              src={item.preview}
              alt={item.title}
              fill
              sizes="96px"
              className="object-contain p-1"
              loading="lazy"
              unoptimized
            />
          </span>
          <span className="w-full truncate px-1 pb-1 text-[10px] font-normal opacity-70">
            {item.title}
          </span>
        </Button>
      ))}
    </div>
  )

  const hasQuery = query.trim().length > 0
  const searched = searchedKey === searchKey
  const banksWithItems = results.banks.filter((result) => result.items.length > 0)
  const sections: Array<{ aiTerms?: string[]; heading: string; items: PictureItem[]; key: string }> = [
    { key: 'mine', heading: hasQuery ? 'Minu pildid' : 'Minu viimased pildid', items: results.mine },
    {
      key: 'library',
      heading: hasQuery ? 'Suhtleja kogu' : 'Suhtleja kogu, uusimad',
      items: results.library,
    },
    ...banksWithItems.map((result) => ({
      aiTerms: result.aiTerms,
      heading: BANK_HEADINGS[result.bank],
      items: result.items,
      key: result.bank,
    })),
  ].filter((section) => section.items.length > 0)
  const ownAndLibraryCount = results.mine.length + results.library.length
  const bankAvailable = (bankCategories?.length ?? 0) > 0
  const showBank = bankAvailable && !hasQuery && (scope === 'all' || scope === 'library')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[760px] max-w-[94vw] overflow-y-auto rounded-2xl p-4 shadow-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Muuda</DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-5">
          <div className="flex items-start gap-4">
            {previewSrc && (
              <div
                className={cn(
                  'relative aspect-square w-28 shrink-0 rounded-lg bg-white',
                  wordClass ? 'border-4' : 'border',
                )}
                style={wordClass ? { borderColor: WORD_CLASS_INFO[wordClass].color } : undefined}
              >
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
                  onClick={() => setQuery(title)}
                  disabled={!title.trim()}
                  title="Otsi pilti selle tekstiga"
                  aria-label="Otsi pilti selle tekstiga"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <Label htmlFor="cell-word-class" className="mt-2 text-lg">
                Sõnaliik
              </Label>
              <Select
                value={wordClass ?? NO_WORD_CLASS}
                onValueChange={(value) => {
                  setWordClass(isWordClass(value) ? value : null)
                  setWordClassSource('manual')
                }}
              >
                <SelectTrigger
                  id="cell-word-class"
                  className="rounded-xl text-sm"
                  aria-describedby="cell-word-class-hint"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Inline content, not flex: the trigger clamps its value to one line, and
                      Safari cut a flex label short ("Tegev…") with room to spare. */}
                  <SelectItem value={NO_WORD_CLASS}>
                    <span
                      aria-hidden="true"
                      className="mr-2 inline-block h-3 w-3 rounded-full border border-dashed border-slate-400 align-[-1px]"
                    />
                    Määramata
                  </SelectItem>
                  {WORD_CLASSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      <span
                        aria-hidden="true"
                        className="mr-2 inline-block h-3 w-3 rounded-full align-[-1px]"
                        style={{ backgroundColor: WORD_CLASS_INFO[value].color }}
                      />
                      {WORD_CLASS_INFO[value].label}{' '}
                      <span className="text-slate-500">({WORD_CLASS_INFO[value].examples})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p id="cell-word-class-hint" className="text-xs text-slate-500">
                {wordClassSource === 'auto' && wordClass
                  ? 'Pakutud sõna järgi. Värv on kaardi ümber, muuda vajadusel.'
                  : 'Värv kaardi ümber aitab lapsel sõnu leida.'}
              </p>
              {verbFormsHint ? (
                <p data-testid="cell-verb-forms" className="text-xs text-slate-700">
                  {verbFormsHint}
                </p>
              ) : null}
            </div>
          </div>

          {/* Picture search */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-[14rem] flex-1 items-center gap-2">
                <Input
                  id="cell-picture-search"
                  value={query}
                  placeholder="Otsi pilti eesti või inglise keeles… (nt koer, sööma, dog)"
                  aria-label="Otsi pilti"
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setBankFolder(null)
                  }}
                  onKeyDown={(e) => {
                    // Search runs while typing; Enter must not submit or close anything.
                    if (e.key === 'Enter') e.preventDefault()
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setTitle(query)}
                  disabled={!query.trim()}
                  title="Kopeeri otsing tekstiväljale"
                  aria-label="Kopeeri otsing tekstiväljale"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Select value={scope} onValueChange={(value: SearchScope) => setScope(value)}>
                <SelectTrigger className="w-[170px] rounded-xl text-sm" aria-label="Pildi allikas">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCOPE_LABELS) as SearchScope[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SCOPE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bankAvailable && (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={openBank}
                  aria-pressed={showBank && !bankFolder}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Kategooriad
                </Button>
              )}
            </div>

            {searchError && <p className="text-xs text-red-500">{searchError}</p>}

            {showBank ? (
              <div className="flex max-h-96 flex-col gap-4 overflow-y-auto p-1">
                {bankFolder ? (
                  <section className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1 px-2"
                        onClick={() => setBankFolder(null)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Kategooriad
                      </Button>
                      <h3 className="text-sm font-semibold">{bankFolder.name}</h3>
                    </div>
                    {bankError ? (
                      <p className="text-xs text-red-500">{bankError}</p>
                    ) : bankPictures?.folderId === bankFolder.id ? (
                      renderTiles(bankPictures.items)
                    ) : (
                      <p className="flex items-center gap-2 text-xs text-slate-500">
                        <Spinner /> Laadin…
                      </p>
                    )}
                  </section>
                ) : (
                  <>
                    {results.mine.length > 0 && (
                      <section className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold">Minu viimased pildid</h3>
                        {renderTiles(results.mine)}
                      </section>
                    )}
                    <section className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold">Pildipank</h3>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {bankCategories?.map((category) => (
                          <Button
                            key={category.id}
                            type="button"
                            variant="outline"
                            onClick={() => setBankFolder({ id: category.id, name: category.name })}
                            className="flex aspect-square h-auto flex-col items-center gap-1 overflow-hidden whitespace-normal rounded-xl border-2 bg-white p-2 hover:border-primary"
                          >
                            <span className="text-center text-xs font-semibold leading-tight">
                              {category.name}
                            </span>
                            {category.cover && (
                              <span className="relative w-full flex-1">
                                <Image
                                  src={category.cover}
                                  alt=""
                                  fill
                                  sizes="96px"
                                  className="object-contain"
                                  loading="lazy"
                                  unoptimized
                                />
                              </span>
                            )}
                          </Button>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>
            ) : searching ? (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Spinner /> Otsin…
              </p>
            ) : sections.length ? (
              <div className="flex max-h-80 flex-col gap-4 overflow-y-auto p-1">
                {sections.map((section) => (
                  <section key={section.key} className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">{section.heading}</h3>
                    {section.aiTerms?.length ? (
                      <p className="text-xs text-slate-500">
                        Otsest vastet ei olnud, AI otsis: {section.aiTerms.join(', ')}
                      </p>
                    ) : null}
                    {renderTiles(section.items)}
                  </section>
                ))}
              </div>
            ) : searched && !searchError ? (
              <p className="text-sm text-slate-500">
                {hasQuery ? 'Sobivat pilti ei leitud.' : 'Sul pole veel oma pilte.'}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleUpload(file)
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                {uploading ? <Spinner /> : <Upload className="h-4 w-4" />}
                Lae üles
              </Button>
              <Button
                type="button"
                size="sm"
                variant={showGenerate ? 'secondary' : 'outline'}
                onClick={openGenerate}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Loo AI-ga
              </Button>
              {banksWithItems.length > 0 && (
                <p className="ml-auto text-[10px] text-slate-400">
                  {banksWithItems.map((result) => BANK_LICENSES[result.bank]).join(' · ')}
                </p>
              )}
            </div>
          </div>

          {/* AI generation */}
          {showGenerate && (
            <div className="flex flex-col gap-3 rounded-xl border bg-slate-50 p-3">
              {hasQuery && ownAndLibraryCount > 0 && (
                <p className="text-xs text-slate-600">
                  Sellele otsingule on juba {ownAndLibraryCount}{' '}
                  {ownAndLibraryCount === 1 ? 'pilt' : 'pilti'} sinu piltides või Suhtleja kogus
                  (üleval). Vali neist, kui mõni sobib.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={genLabel}
                  maxLength={80}
                  aria-label="Mida AI-pilt näitab"
                  onChange={(e) => setGenLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
                    e.preventDefault()
                    void runGenerate()
                  }}
                  className="min-w-0 flex-1 bg-white"
                  placeholder="Mida pilt näitab? nt koer, jooma, veel"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={runGenerate}
                  disabled={genLoading || !genLabel.trim() || genQuota?.remaining === 0}
                  className="gap-2"
                >
                  {genLoading ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                  Loo pildid
                </Button>
              </div>

              <p className="text-xs text-slate-500">
                AI loob 4 pilti ühtses piktogrammi stiilis. Valitud pilt salvestub „Salvesta“
                vajutamisel sinu piltide hulka ja ühisesse Suhtleja kogusse, et ka teised
                pered saaksid seda kasutada. Nime või muu isikliku tekstiga pilte ei jagata.
                {genQuota && ` Sel kuul alles ${genQuota.remaining}/${genQuota.limit} korda.`}
              </p>

              {genError && <p className="text-xs text-red-500">{genError}</p>}

              {genLoading ? (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <Spinner /> Loon pilte… see võtab mõne sekundi.
                </p>
              ) : genImages.length && genGenerationId !== null ? (
                <>
                  {genPersonal && (
                    <p className="text-xs text-slate-500">
                      Tekst tundub isiklik, seega jääb see pilt ainult sinu piltide hulka.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {genImages.map((src, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setPending({ kind: 'generated', dataURL: src, generationId: genGenerationId })
                        }
                        className={tileClass(src)}
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
                </>
              ) : null}
            </div>
          )}
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
            className="gap-2"
          >
            {saving && <Spinner />}
            Salvesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
