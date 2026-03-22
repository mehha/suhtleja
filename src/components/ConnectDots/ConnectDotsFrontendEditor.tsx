'use client'

import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ArrowDown, ArrowUp, PencilRuler, Search, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Toaster } from '@/components/ui/sonner'
import { getClientSideURL } from '@/utilities/getURL'
import { getSymbolProxyURL } from '@/utilities/symbolProxy'
import { useUnsavedChangesGuard } from '@/utilities/useUnsavedChangesGuard'
import {
  type ConnectDotsPoint,
  getContainedImageRect,
  getNormalizedPointFromContainedRect,
  moveItem,
  normalizeDots,
  validateConnectDotsDots,
} from '@/utilities/connectDots'
import { ConnectDotsAdminPreview } from './ConnectDotsAdminPreview'
import styles from './ConnectDotsAdmin.module.css'

const MIN_DOT_DISTANCE_PX = 16
const DOT_SPACING_TOAST_ID = 'connect-dots-spacing-frontend'

type MediaState = {
  alt?: string | null
  height?: number | null
  id?: number | string | null
  source?: 'arasaac' | 'openmoji' | 'upload'
  url?: string | null
  width?: number | null
}

type Mode = 'edit' | 'preview'

type SymbolItem = {
  attribution?: string
  id: string
  license: string
  preview: string
  source: 'arasaac' | 'openmoji'
  title: string
}

type InitialPuzzle = {
  description?: null | string
  dots?: ConnectDotsPoint[] | unknown
  enabled?: boolean | null
  externalImageURL?: null | string
  image?: unknown
  title?: null | string
  visibleToAllUsers?: boolean | null
}

type Props = {
  action: (formData: FormData) => Promise<void>
  cancelHref: string
  canShareGlobally: boolean
  initialPuzzle?: InitialPuzzle
  submitLabel: string
}

type MediaUploadResponse = {
  doc?: {
    id?: string | number
    url?: null | string
  }
}

function SubmitButton({ disabled, label }: { disabled?: boolean; label: string }) {
  const { pending } = useFormStatus()

  return (
    <Button disabled={pending || disabled} type="submit">
      {pending ? 'Salvestan…' : label}
    </Button>
  )
}

export function ConnectDotsFrontendEditor({
  action,
  cancelHref,
  canShareGlobally,
  initialPuzzle,
  submitLabel,
}: Props) {
  const [title, setTitle] = useState(initialPuzzle?.title ?? '')
  const [description, setDescription] = useState(initialPuzzle?.description ?? '')
  const [enabled, setEnabled] = useState(initialPuzzle?.enabled ?? true)
  const [visibleToAllUsers, setVisibleToAllUsers] = useState(initialPuzzle?.visibleToAllUsers ?? false)
  const [dots, setDots] = useState<ConnectDotsPoint[]>(normalizeDots(initialPuzzle?.dots))
  const [externalImageURL, setExternalImageURL] = useState(initialPuzzle?.externalImageURL?.trim() ?? '')
  const [imageState, setImageState] = useState<MediaState>(getMediaState(initialPuzzle?.image))
  const [media, setMedia] = useState<MediaState | null>(() => {
    const fromImage = getMediaState(initialPuzzle?.image)

    if (fromImage.url) {
      return { ...fromImage, source: 'upload' }
    }

    if (initialPuzzle?.externalImageURL) {
      return {
        source: inferExternalSymbolSource(initialPuzzle.externalImageURL) ?? 'arasaac',
        url: getSymbolProxyURL(initialPuzzle.externalImageURL),
      }
    }

    return null
  })
  const [mode, setMode] = useState<Mode>('edit')
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 })
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [symbolQuery, setSymbolQuery] = useState('')
  const [symbolSource, setSymbolSource] = useState<'arasaac' | 'openmoji'>('arasaac')
  const [selectedSymbolTitle, setSelectedSymbolTitle] = useState<string | null>(null)
  const [symbolResults, setSymbolResults] = useState<SymbolItem[]>([])
  const [symbolLoading, setSymbolLoading] = useState(false)
  const [symbolError, setSymbolError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const dotsRef = useRef<ConnectDotsPoint[]>(dots)
  const dragMovedRef = useRef(false)
  const initialState = {
    description: initialPuzzle?.description?.trim() || '',
    dots: normalizeDots(initialPuzzle?.dots),
    enabled: initialPuzzle?.enabled ?? true,
    externalImageURL: initialPuzzle?.externalImageURL?.trim() ?? '',
    imageId: getMediaState(initialPuzzle?.image).id ? String(getMediaState(initialPuzzle?.image).id) : '',
    title: initialPuzzle?.title?.trim() ?? '',
    visibleToAllUsers: initialPuzzle?.visibleToAllUsers ?? false,
  }

  useEffect(() => {
    dotsRef.current = dots

    if (selectedIndex === null) return
    if (selectedIndex >= dots.length) {
      setSelectedIndex(dots.length > 0 ? dots.length - 1 : null)
    }
  }, [dots, selectedIndex])

  useEffect(() => {
    let cancelled = false

    if (imageState.url) {
      setMedia({ ...imageState, source: 'upload' })
      return
    }

    if (externalImageURL) {
      const inferredSource = inferExternalSymbolSource(externalImageURL)
      if (inferredSource) {
        setSymbolSource(inferredSource)
      }

      setMedia({
        source: inferredSource ?? symbolSource,
        url: getSymbolProxyURL(externalImageURL),
      })
      return
    }

    if (!imageState.id) {
      setMedia(null)
      return
    }

    setMedia((current) => (current?.id === imageState.id ? current : { id: imageState.id }))

    void (async () => {
      try {
        const response = await fetch(`/api/media/${imageState.id}`, { credentials: 'same-origin' })

        if (!response.ok) return

        const payload = (await response.json()) as MediaState
        if (!cancelled) {
          setMedia({ ...getMediaState(payload), source: 'upload' })
        }
      } catch {
        if (!cancelled) {
          setMedia(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [externalImageURL, imageState, symbolSource])

  useEffect(() => {
    if (mode !== 'edit' || !boardRef.current) return

    const element = boardRef.current
    const updateSize = () => {
      setBoardSize({
        width: element.clientWidth,
        height: element.clientHeight,
      })
    }

    updateSize()

    const observer = new ResizeObserver(() => {
      updateSize()
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [mode])

  const imageAspectRatio =
    media?.width && media?.height ? `${media.width} / ${media.height}` : '4 / 3'
  const renderRect = getContainedImageRect(boardSize.width, boardSize.height, media?.width, media?.height)
  const svgWidth = Math.max(renderRect.width, 1)
  const svgHeight = Math.max(renderRect.height, 1)

  const previewPuzzle =
    media?.url && dots.length >= 2
      ? [
          {
            id: 'draft',
            title: title.trim() || 'Eelvaade',
            description: description.trim() || null,
            imageAlt: media.alt ?? null,
            imageHeight: media.height ?? null,
            imageUrl: media.url,
            imageWidth: media.width ?? null,
            dots,
          },
        ]
      : []

  const validationMessage = validateConnectDotsDots(dots)
  const isDirty =
    title.trim() !== initialState.title ||
    description.trim() !== initialState.description ||
    enabled !== initialState.enabled ||
    visibleToAllUsers !== initialState.visibleToAllUsers ||
    externalImageURL.trim() !== initialState.externalImageURL ||
    (imageState.id ? String(imageState.id) : '') !== initialState.imageId ||
    JSON.stringify(dots) !== JSON.stringify(initialState.dots)
  const {
    dialogOpen: leaveDialogOpen,
    setDialogOpen: setLeaveDialogOpen,
    confirmNavigation: confirmLeave,
  } = useUnsavedChangesGuard({
    enabled: isDirty,
  })

  const commitDots = (nextDots: ConnectDotsPoint[]) => {
    setDots(nextDots)
  }

  const notifyDotTooClose = () => {
    toast.warning('Punkt on teisele punktile liiga lähedal.', {
      description: 'Jäta punktide vahele natuke rohkem ruumi.',
      id: DOT_SPACING_TOAST_ID,
    })
  }

  const isTooCloseToOtherDots = (point: ConnectDotsPoint, ignoreIndex?: number): boolean =>
    dotsRef.current.some((existingPoint, index) => {
      if (typeof ignoreIndex === 'number' && index === ignoreIndex) {
        return false
      }

      const dx = (existingPoint.x - point.x) * renderRect.width
      const dy = (existingPoint.y - point.y) * renderRect.height
      return Math.sqrt(dx * dx + dy * dy) < MIN_DOT_DISTANCE_PX
    })

  const getBoardPoint = (
    event: Pick<ReactMouseEvent<HTMLElement>, 'clientX' | 'clientY'>,
  ): ConnectDotsPoint | null => {
    if (!boardRef.current) return null

    const bounds = boardRef.current.getBoundingClientRect()
    return getNormalizedPointFromContainedRect({
      bounds,
      clientX: event.clientX,
      clientY: event.clientY,
      rect: renderRect,
    })
  }

  const handleCanvasClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (mode !== 'edit') return

    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }

    const target = event.target as HTMLElement
    if (target.closest('[data-dot-handle="true"]')) {
      return
    }

    const point = getBoardPoint(event)
    if (!point) return

    if (isTooCloseToOtherDots(point)) {
      notifyDotTooClose()
      return
    }

    const nextDots = [...dotsRef.current, point]
    commitDots(nextDots)
    setSelectedIndex(nextDots.length - 1)
  }

  const handleDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingIndex === null) return

    dragMovedRef.current = true

    const point = getBoardPoint(event)
    if (!point) return

    if (isTooCloseToOtherDots(point, draggingIndex)) {
      notifyDotTooClose()
      return
    }

    const nextDots = [...dotsRef.current]
    nextDots[draggingIndex] = point
    commitDots(nextDots)
    setSelectedIndex(draggingIndex)
  }

  const removeSelected = () => {
    if (selectedIndex === null) return

    const nextDots = dots.filter((_, index) => index !== selectedIndex)
    commitDots(nextDots)
    setSelectedIndex(nextDots.length ? Math.min(selectedIndex, nextDots.length - 1) : null)
  }

  const moveSelected = (direction: -1 | 1) => {
    if (selectedIndex === null) return

    const nextIndex = selectedIndex + direction
    const nextDots = moveItem(dots, selectedIndex, nextIndex)

    commitDots(nextDots)
    if (nextDots !== dots) {
      setSelectedIndex(Math.max(0, Math.min(nextDots.length - 1, nextIndex)))
    }
  }

  const runSymbolSearch = async () => {
    const query = symbolQuery.trim()

    if (!query) {
      setSymbolResults([])
      setSymbolError(null)
      return
    }

    setSymbolLoading(true)
    setSymbolError(null)

    try {
      const base = getClientSideURL()
      const response = await fetch(
        `${base}/next/symbols?q=${encodeURIComponent(query)}&source=${symbolSource}&limit=24`,
        { credentials: 'include' },
      )

      if (!response.ok) {
        throw new Error('symbols_failed')
      }

      const payload = (await response.json()) as { items?: SymbolItem[] }
      setSymbolResults(Array.isArray(payload.items) ? payload.items : [])
    } catch {
      setSymbolResults([])
      setSymbolError('Sümbolite laadimine ebaõnnestus.')
    } finally {
      setSymbolLoading(false)
    }
  }

  const pickSymbol = (symbol: SymbolItem) => {
    setExternalImageURL(symbol.preview)
    setImageState({})
    setSelectedSymbolTitle(symbol.title)
    setMedia({
      source: symbol.source,
      url: getSymbolProxyURL(symbol.preview),
    })
  }

  const handleUpload = async (file: File) => {
    setUploading(true)

    try {
      const base = getClientSideURL()
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${base}/api/media`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('upload_failed')
      }

      const payload = (await response.json()) as MediaUploadResponse
      if (payload?.doc?.id) {
        setImageState({
          id: payload.doc.id,
          url: payload.doc.url ?? null,
        })
        setExternalImageURL('')
        setSelectedSymbolTitle(null)
      }
    } catch {
      toast.error('Pildi üleslaadimine ebaõnnestus.')
    } finally {
      setUploading(false)
    }
  }

  const selectedSymbolSource = externalImageURL
    ? inferExternalSymbolSource(externalImageURL) ?? media?.source ?? symbolSource
    : null
  const selectedSymbolLabel =
    selectedSymbolSource === 'arasaac'
      ? 'ARASAAC'
      : selectedSymbolSource === 'openmoji'
        ? 'OpenMoji'
        : 'Sümbol'
  const previewEnabled = Boolean(media?.url && dots.length >= 2)

  return (
    <form action={action} className="space-y-6">
      <Toaster />

      <input name="dots" type="hidden" value={JSON.stringify(dots)} />
      <input name="enabled" type="hidden" value={enabled ? 'true' : 'false'} />
      <input name="externalImageURL" type="hidden" value={externalImageURL} />
      <input name="imageId" type="hidden" value={imageState.id ? String(imageState.id) : ''} />
      <input
        name="visibleToAllUsers"
        type="hidden"
        value={visibleToAllUsers ? 'true' : 'false'}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <PencilRuler className="h-4 w-4 text-sky-600" />
            <h1 className="text-2xl font-semibold">Halda connect-dots puzzle&apos;it</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Vali pilt, lisa punktid õiges järjekorras ja salvesta puzzle oma kogusse.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-full border bg-card px-4 py-2">
            <span className="text-sm font-medium text-muted-foreground">Muuda</span>
            <Switch
              checked={mode === 'preview'}
              disabled={!previewEnabled && mode === 'edit'}
              onCheckedChange={(checked) => {
                setMode(checked ? 'preview' : 'edit')
              }}
              aria-label="Lülita eelvaate režiim"
            />
            <span className="text-sm font-medium text-muted-foreground">Eelvaade</span>
          </div>
          <SubmitButton disabled={!isDirty} label={submitLabel} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="connect-dots-title">Pealkiri</Label>
          <Input
            id="connect-dots-title"
            name="title"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nt Kass"
            required
            value={title}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="connect-dots-description">Kirjeldus</Label>
          <Textarea
            id="connect-dots-description"
            name="description"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Lühike abitekst puzzle valiku alla"
            rows={3}
            value={description}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 rounded-2xl border bg-card px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox checked={enabled} onCheckedChange={(checked) => setEnabled(checked === true)} />
          <span>Nähtav /connect-dots lehel</span>
        </label>

        {canShareGlobally ? (
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={visibleToAllUsers}
              onCheckedChange={(checked) => setVisibleToAllUsers(checked === true)}
            />
            <span>Nähtav kõigile kasutajatele</span>
          </label>
        ) : null}
      </div>

      {mode === 'preview' ? (
        previewPuzzle.length > 0 ? (
          <ConnectDotsAdminPreview puzzle={previewPuzzle[0]} />
        ) : (
          <div className={styles.helperBox}>Eelvaade vajab pilti ja vähemalt kahte punkti.</div>
        )
      ) : (
        <div className={styles.grid}>
          <div
            ref={boardRef}
            className={styles.board}
            style={{ aspectRatio: imageAspectRatio }}
            onClick={handleCanvasClick}
            onPointerLeave={() => {
              setDraggingIndex(null)
              dragMovedRef.current = false
            }}
            onPointerMove={handleDragMove}
            onPointerUp={(event) => {
              if (boardRef.current?.hasPointerCapture(event.pointerId)) {
                boardRef.current.releasePointerCapture(event.pointerId)
              }

              setDraggingIndex(null)
              window.setTimeout(() => {
                dragMovedRef.current = false
              }, 0)
            }}
          >
            {media?.url ? (
              <div
                style={{
                  height: renderRect.height,
                  left: renderRect.left,
                  position: 'absolute',
                  top: renderRect.top,
                  width: renderRect.width,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={media.alt || 'Punktide ühendamise lähtepilt'}
                  className={styles.image}
                  draggable={false}
                  src={media.url}
                />

                <div className={styles.imageOverlay} />

                <svg className={styles.svg} preserveAspectRatio="none" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                  {dots.map((dot, index) => {
                    const dotX = dot.x * svgWidth
                    const dotY = dot.y * svgHeight

                    return (
                      <g
                        key={`frontend-dot-${index}`}
                        data-dot-handle="true"
                        onPointerDown={(event) => {
                          event.stopPropagation()
                          setSelectedIndex(index)
                          setDraggingIndex(index)
                          dragMovedRef.current = false
                          boardRef.current?.setPointerCapture(event.pointerId)
                        }}
                      >
                        <circle cx={dotX} cy={dotY} fill="transparent" r="18" />
                        <circle
                          cx={dotX}
                          cy={dotY}
                          fill={selectedIndex === index ? '#0ea5e9' : '#ffffff'}
                          r="8"
                          stroke={selectedIndex === index ? '#0369a1' : '#475569'}
                          strokeWidth="2"
                        />
                        <text
                          fill={selectedIndex === index ? '#ffffff' : '#0f172a'}
                          fontFamily="ui-sans-serif, system-ui, sans-serif"
                          fontSize="11"
                          fontWeight="700"
                          x={dotX + 12}
                          y={dotY - 10}
                        >
                          {index + 1}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>
            ) : (
              <div className={styles.placeholder}>Laadi või vali kõigepealt pilt.</div>
            )}
          </div>

          <aside className={styles.sidebar}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>Punktid</p>
                  <p className={styles.panelText}>
                    Klõps pildil lisab järgmise punkti. Valitud punkt on sinine.
                  </p>
                </div>
                <div className={styles.countPill}>{dots.length}</div>
              </div>

              <div className={styles.buttonRow} style={{ marginTop: 16 }}>
                <Button
                  disabled={selectedIndex === null || selectedIndex <= 0}
                  onClick={() => moveSelected(-1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ArrowUp className="mr-1 h-4 w-4" />
                  Varasemaks
                </Button>
                <Button
                  disabled={selectedIndex === null || selectedIndex >= dots.length - 1}
                  onClick={() => moveSelected(1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ArrowDown className="mr-1 h-4 w-4" />
                  Hilisemaks
                </Button>
                <Button
                  disabled={selectedIndex === null}
                  onClick={removeSelected}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Eemalda
                </Button>
                <Button
                  disabled={dots.length === 0}
                  onClick={() => {
                    commitDots([])
                    setSelectedIndex(null)
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Eemalda kõik
                </Button>
              </div>

              <div className={styles.dotList}>
                {dots.map((dot, index) => (
                  <button
                    key={`frontend-dot-row-${index}`}
                    className={`${styles.dotRow} ${selectedIndex === index ? styles.dotRowActive : ''}`}
                    onClick={() => setSelectedIndex(index)}
                    type="button"
                  >
                    <span className={styles.dotLabel}>Punkt {index + 1}</span>
                    <span className={styles.dotCoords}>
                      {dot.x.toFixed(3)}, {dot.y.toFixed(3)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.helperBox}>
              {validationMessage === true
                ? 'Puzzle salvestamiseks peab pilt olema valitud ja punkte peab olema vähemalt kaks.'
                : validationMessage}
            </div>

            <div className={styles.panel}>
              <p className={styles.panelTitle}>Pildi allikas</p>
              <p className={styles.panelText}>Laadi enda pilt üles või vali ARASAAC / OpenMoji sümbol.</p>

              <Tabs className="mt-4" defaultValue="upload">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">Laadi üles</TabsTrigger>
                  <TabsTrigger value="symbols">Sümbolid</TabsTrigger>
                </TabsList>

                <TabsContent className="space-y-4" value="upload">
                  <div className="space-y-2">
                    <Label htmlFor="connect-dots-upload">Pildifail</Label>
                    <Input
                      id="connect-dots-upload"
                      accept="image/*"
                      disabled={uploading}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        const file = event.target.files?.[0]
                        if (file) {
                          void handleUpload(file)
                          event.target.value = ''
                        }
                      }}
                      type="file"
                    />
                  </div>
                  <Button disabled={uploading} size="sm" type="button" variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? 'Laen üles…' : 'Vali fail ülal'}
                  </Button>
                </TabsContent>

                <TabsContent className="space-y-4" value="symbols">
                  <div className="space-y-2">
                    <Label htmlFor="connect-dots-symbol-search">Otsi sümbolit</Label>
                    <div className="flex gap-2">
                      <Input
                        id="connect-dots-symbol-search"
                        onChange={(event) => setSymbolQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void runSymbolSearch()
                          }
                        }}
                        placeholder="nt kass, koer, play, eat"
                        value={symbolQuery}
                      />
                      <Button onClick={() => void runSymbolSearch()} type="button" variant="outline">
                        <Search className="mr-2 h-4 w-4" />
                        Otsi
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSymbolSource('arasaac')}
                      type="button"
                      variant={symbolSource === 'arasaac' ? 'default' : 'outline'}
                    >
                      ARASAAC
                    </Button>
                    <Button
                      onClick={() => setSymbolSource('openmoji')}
                      type="button"
                      variant={symbolSource === 'openmoji' ? 'default' : 'outline'}
                    >
                      OpenMoji
                    </Button>
                  </div>

                  {symbolError ? <p className={styles.errorText}>{symbolError}</p> : null}
                  {symbolLoading ? <p className={styles.panelText}>Laen sümboleid…</p> : null}

                  {symbolResults.length > 0 ? (
                    <>
                      <div className={styles.symbolGrid}>
                        {symbolResults.map((symbol) => (
                          <button
                            key={symbol.id}
                            className={`${styles.symbolCard} ${
                              externalImageURL === symbol.preview ? styles.symbolCardActive : ''
                            }`}
                            onClick={() => pickSymbol(symbol)}
                            type="button"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              alt={symbol.title}
                              className={styles.symbolThumb}
                              src={getSymbolProxyURL(symbol.preview) || symbol.preview}
                            />
                            <span className={styles.symbolCaption}>{symbol.title}</span>
                          </button>
                        ))}
                      </div>
                      <p className={styles.licenseText}>
                        ARASAAC: CC BY-NC-SA 4.0. OpenMoji: CC BY-SA 4.0.
                      </p>
                    </>
                  ) : null}
                </TabsContent>
              </Tabs>

              {media?.url ? (
                <div className={styles.selectedSymbolCard}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={selectedSymbolTitle || media.alt || 'Valitud pilt'}
                    className={styles.selectedSymbolThumb}
                    src={media.url}
                  />
                  <div className={styles.selectedSymbolMeta}>
                    <p className={styles.selectedSymbolTitle}>{selectedSymbolTitle || media.alt || 'Valitud pilt'}</p>
                    <p className={styles.selectedSymbolSource}>
                      {externalImageURL ? `${selectedSymbolLabel} on kasutusel` : 'Üles laaditud pilt on kasutusel'}
                    </p>
                  </div>
                </div>
              ) : null}

              {(externalImageURL || imageState.id) ? (
                <div className={styles.buttonRow}>
                  <Button
                    onClick={() => {
                      setExternalImageURL('')
                      setImageState({})
                      setSelectedSymbolTitle(null)
                      setMedia(null)
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Eemalda pilt
                  </Button>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button asChild type="button" variant="outline">
          <Link href={cancelHref}>Tagasi</Link>
        </Button>

        <SubmitButton disabled={!isDirty} label={submitLabel} />
      </div>

      <UnsavedChangesDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        onConfirm={confirmLeave}
      />
    </form>
  )
}

function inferExternalSymbolSource(url: string): 'arasaac' | 'openmoji' | null {
  const normalizedUrl = url.toLowerCase()

  if (normalizedUrl.includes('arasaac')) {
    return 'arasaac'
  }

  if (normalizedUrl.includes('openmoji')) {
    return 'openmoji'
  }

  return null
}

function getMediaState(value: unknown): MediaState {
  if (!value) {
    return {}
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return { id: value }
  }

  if (typeof value !== 'object') {
    return {}
  }

  const media = value as Record<string, unknown>

  return {
    alt: typeof media.alt === 'string' ? media.alt : null,
    height: typeof media.height === 'number' ? media.height : null,
    id:
      typeof media.id === 'string' || typeof media.id === 'number'
        ? media.id
        : typeof media.value === 'string' || typeof media.value === 'number'
          ? media.value
          : null,
    url: typeof media.url === 'string' ? media.url : null,
    width: typeof media.width === 'number' ? media.width : null,
  }
}
