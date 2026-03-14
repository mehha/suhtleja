'use client'
import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { UIFieldClientProps } from 'payload'
import { Button, TextInput, useField } from '@payloadcms/ui'
import { ArrowDown, ArrowUp, PencilRuler, Play, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getClientSideURL } from '@/utilities/getURL'
import { getSymbolProxyURL } from '@/utilities/symbolProxy'
import { Toaster } from '@/components/ui/sonner'
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
const DOT_SPACING_TOAST_ID = 'connect-dots-spacing'

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

export function ConnectDotsEditorField(_props: UIFieldClientProps) {
  const { setValue: setDotsValue, value: rawDotsValue } = useField<unknown>({ path: 'dots' })
  const { setValue: setExternalImageURLValue, value: externalImageURLValue } = useField<string | null>({
    path: 'externalImageURL',
  })
  const { setValue: setImageValue, value: imageValue } = useField<unknown>({ path: 'image' })
  const { value: titleValue } = useField<string>({ path: 'title' })
  const [media, setMedia] = useState<MediaState | null>(null)
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
  const boardRef = useRef<HTMLDivElement | null>(null)
  const dragMovedRef = useRef(false)

  const dots = useMemo(() => normalizeDots(rawDotsValue), [rawDotsValue])
  const dotsRef = useRef<ConnectDotsPoint[]>(dots)

  useEffect(() => {
    dotsRef.current = dots

    if (selectedIndex === null) {
      return
    }

    if (selectedIndex >= dots.length) {
      setSelectedIndex(dots.length > 0 ? dots.length - 1 : null)
    }
  }, [dots, selectedIndex])

  useEffect(() => {
    let cancelled = false

    const resolved = getMediaState(imageValue)
    const externalImageURL = typeof externalImageURLValue === 'string' ? externalImageURLValue.trim() : ''

    if (resolved.url) {
      setMedia({ ...resolved, source: 'upload' })
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

    if (!resolved.id) {
      setMedia(null)
      return
    }

    setMedia((current) => (current?.id === resolved.id ? current : { id: resolved.id }))

    void (async () => {
      try {
        const response = await fetch(`/api/media/${resolved.id}`, { credentials: 'same-origin' })

        if (!response.ok) {
          return
        }

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
  }, [externalImageURLValue, imageValue, symbolSource])

  useEffect(() => {
    if (mode !== 'edit' || !boardRef.current) {
      return
    }

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
            title: typeof titleValue === 'string' && titleValue.trim() ? titleValue.trim() : 'Eelvaade',
            description: null,
            imageAlt: media.alt ?? null,
            imageHeight: media.height ?? null,
            imageUrl: media.url,
            imageWidth: media.width ?? null,
            dots,
          },
        ]
      : []

  const validationMessage = validateConnectDotsDots(dots)

  const commitDots = (nextDots: ConnectDotsPoint[]) => {
    setDotsValue(nextDots)
  }

  const notifyDotTooClose = () => {
    toast.warning('Punkt on teisele punktile liiga lähedal.', {
      description: 'Jäta punktide vahele natuke rohkem ruumi.',
      id: DOT_SPACING_TOAST_ID,
    })
  }

  const isTooCloseToOtherDots = (point: ConnectDotsPoint, ignoreIndex?: number): boolean => {
    return dotsRef.current.some((existingPoint, index) => {
      if (typeof ignoreIndex === 'number' && index === ignoreIndex) {
        return false
      }

      const dx = (existingPoint.x - point.x) * renderRect.width
      const dy = (existingPoint.y - point.y) * renderRect.height
      return Math.sqrt(dx * dx + dy * dy) < MIN_DOT_DISTANCE_PX
    })
  }

  const getBoardPoint = (
    event: Pick<ReactMouseEvent<HTMLElement>, 'clientX' | 'clientY'>,
  ): ConnectDotsPoint | null => {
    if (!boardRef.current) {
      return null
    }

    const bounds = boardRef.current.getBoundingClientRect()
    return getNormalizedPointFromContainedRect({
      bounds,
      clientX: event.clientX,
      clientY: event.clientY,
      rect: renderRect,
    })
  }

  const handleCanvasClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (mode !== 'edit') {
      return
    }

    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }

    const target = event.target as HTMLElement
    if (target.closest('[data-dot-handle="true"]')) {
      return
    }

    const point = getBoardPoint(event)
    if (!point) {
      return
    }

    if (isTooCloseToOtherDots(point)) {
      notifyDotTooClose()
      return
    }

    const nextDots = [...dotsRef.current, point]
    commitDots(nextDots)
    setSelectedIndex(nextDots.length - 1)
  }

  const handleDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingIndex === null) {
      return
    }

    dragMovedRef.current = true

    const point = getBoardPoint(event)
    if (!point) {
      return
    }

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
    if (selectedIndex === null) {
      return
    }

    const nextDots = dots.filter((_, index) => index !== selectedIndex)
    commitDots(nextDots)
    setSelectedIndex(nextDots.length ? Math.min(selectedIndex, nextDots.length - 1) : null)
  }

  const moveSelected = (direction: -1 | 1) => {
    if (selectedIndex === null) {
      return
    }

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
    setExternalImageURLValue(symbol.preview)
    setImageValue(null)
    setSelectedSymbolTitle(symbol.title)
    setMedia({
      source: symbol.source,
      url: getSymbolProxyURL(symbol.preview),
    })
  }

  const selectedExternalImageURL = typeof externalImageURLValue === 'string' ? externalImageURLValue.trim() : ''
  const selectedSymbolSource = selectedExternalImageURL
    ? inferExternalSymbolSource(selectedExternalImageURL) ?? media?.source ?? symbolSource
    : null
  const selectedSymbolLabel =
    selectedSymbolSource === 'arasaac'
      ? 'ARASAAC'
      : selectedSymbolSource === 'openmoji'
        ? 'OpenMoji'
        : 'Sümbol'

  return (
    <div className={styles.shell}>
      <Toaster />
      <div className={styles.header}>
        <div className={styles.headingBlock}>
          <div className={styles.titleRow}>
            <PencilRuler color="#0ea5e9" size={16} />
            <h3 className={styles.title}>Punktide ühendamise redaktor</h3>
          </div>
          <p className={styles.description}>
            Vali pilt, klõpsa sellel uute punktide lisamiseks ja lohista olemasolevaid punkte õigesse
            järjekorda.
          </p>
        </div>

        <div className={styles.toolbar}>
          <Button
            buttonStyle={mode === 'edit' ? 'primary' : 'secondary'}
            className={styles.payloadButton}
            onClick={() => setMode('edit')}
            size="medium"
            type="button"
          >
            Muuda
          </Button>
          <Button
            buttonStyle={mode === 'preview' ? 'primary' : 'secondary'}
            className={styles.payloadButton}
            disabled={!media?.url || dots.length < 2}
            onClick={() => setMode('preview')}
            size="medium"
            type="button"
          >
            <Play size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            Eelvaade
          </Button>
        </div>
      </div>

      {mode === 'preview' ? (
        previewPuzzle.length > 0 ? (
          <ConnectDotsAdminPreview puzzle={previewPuzzle[0]} />
        ) : (
          <div className={styles.helperBox}>
            Eelvaade vajab salvestatud pilti ja vähemalt kahte punkti.
          </div>
        )
      ) : (
        <>
          <div className={styles.grid}>
            <div
              ref={boardRef}
              className={styles.board}
              style={{ aspectRatio: imageAspectRatio }}
              onClick={handleCanvasClick}
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
              onPointerLeave={() => {
                setDraggingIndex(null)
                dragMovedRef.current = false
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
                  {/* next/image fill breaks containment in the Payload admin canvas here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={media.alt || 'Punktide ühendamise lähtepilt'}
                    className={styles.image}
                    draggable={false}
                    src={media.url}
                  />

                  <div className={styles.imageOverlay} />

                  <svg
                    className={styles.svg}
                    preserveAspectRatio="none"
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  >
                    {dots.map((dot, index) => {
                      const dotX = dot.x * svgWidth
                      const dotY = dot.y * svgHeight

                      return (
                        <g
                          key={`editor-dot-${index}`}
                          data-dot-handle="true"
                          onPointerDown={(event) => {
                            event.stopPropagation()
                            setSelectedIndex(index)
                            setDraggingIndex(index)
                            dragMovedRef.current = false
                            boardRef.current?.setPointerCapture(event.pointerId)
                          }}
                        >
                          <circle
                            cx={dotX}
                            cy={dotY}
                            fill="transparent"
                            r="18"
                          />
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
                <div className={styles.placeholder}>
                  Laadi või vali kõigepealt pilt.
                </div>
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
                    buttonStyle="secondary"
                    className={styles.payloadButton}
                    disabled={selectedIndex === null || selectedIndex <= 0}
                    onClick={() => moveSelected(-1)}
                    size="small"
                    type="button"
                  >
                    <ArrowUp size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                    Varasemaks
                  </Button>
                  <Button
                    buttonStyle="secondary"
                    className={styles.payloadButton}
                    disabled={selectedIndex === null || selectedIndex >= dots.length - 1}
                    onClick={() => moveSelected(1)}
                    size="small"
                    type="button"
                  >
                    <ArrowDown size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                    Hilisemaks
                  </Button>
                  <Button
                    buttonStyle="secondary"
                    className={styles.payloadButton}
                    disabled={selectedIndex === null}
                    onClick={removeSelected}
                    size="small"
                    type="button"
                  >
                    <Trash2 size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                    Eemalda
                  </Button>
                  <Button
                    buttonStyle="secondary"
                    className={styles.payloadButton}
                    disabled={dots.length === 0}
                    onClick={() => {
                      commitDots([])
                      setSelectedIndex(null)
                    }}
                    size="small"
                    type="button"
                  >
                    Eemalda kõik
                  </Button>
                </div>

                <div className={styles.dotList}>
                  {dots.map((dot, index) => (
                    <button
                      key={`dot-row-${index}`}
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
                {validationMessage === true ? (
                  'Eelvaade ja frontendis mängimine töötavad pärast pildi ja punktide salvestamist. Punktide vaheline miinimum on 16 px.'
                ) : (
                  validationMessage
                )}
              </div>

              <div className={styles.panel}>
                <div>
                  <p className={styles.panelTitle}>ARASAAC / OpenMoji</p>
                  <p className={styles.panelText}>
                    Otsi sümbol ja kasuta seda puzzle alusena ilma üles laadimata.
                  </p>
                </div>

                <div className={styles.formStack}>
                  <div className={styles.searchRow}>
                    <TextInput
                      label="Otsi sümbolit"
                      className={styles.payloadInput}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setSymbolQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void runSymbolSearch()
                        }
                      }}
                      path="connect-dots-symbol-search"
                      placeholder="nt kass, koer, play, eat"
                      value={symbolQuery}
                    />
                    <Button
                      buttonStyle="secondary"
                      className={styles.payloadButton}
                      margin={false}
                      onClick={() => void runSymbolSearch()}
                      size="medium"
                      type="button"
                    >
                      <Search size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                      Otsi
                    </Button>
                  </div>
                </div>

                <div className={styles.modeRow}>
                  <Button
                    buttonStyle={symbolSource === 'arasaac' ? 'primary' : 'secondary'}
                    className={styles.payloadButton}
                    onClick={() => setSymbolSource('arasaac')}
                    size="small"
                    type="button"
                  >
                    ARASAAC
                  </Button>
                  <Button
                    buttonStyle={symbolSource === 'openmoji' ? 'primary' : 'secondary'}
                    className={styles.payloadButton}
                    onClick={() => setSymbolSource('openmoji')}
                    size="small"
                    type="button"
                  >
                    OpenMoji
                  </Button>
                </div>

                {symbolError ? <p className={styles.errorText}>{symbolError}</p> : null}
                {symbolLoading ? <p className={styles.panelText}>Laen sümboleid…</p> : null}

                {selectedExternalImageURL ? (
                  <div className={styles.selectedSymbolCard}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={selectedSymbolTitle || 'Valitud sümbol'}
                      className={styles.selectedSymbolThumb}
                      src={getSymbolProxyURL(selectedExternalImageURL) || selectedExternalImageURL}
                    />
                    <div className={styles.selectedSymbolMeta}>
                      <p className={styles.selectedSymbolTitle}>{selectedSymbolTitle || 'Valitud sümbol'}</p>
                      <p className={styles.selectedSymbolSource}>{selectedSymbolLabel} on kasutusel</p>
                    </div>
                  </div>
                ) : null}

                {symbolResults.length > 0 ? (
                  <>
                    <div className={styles.symbolGrid}>
                      {symbolResults.map((symbol) => (
                        <button
                          key={symbol.id}
                          className={`${styles.symbolCard} ${
                            selectedExternalImageURL === symbol.preview ? styles.symbolCardActive : ''
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

                {externalImageURLValue ? (
                  <div className={styles.buttonRow}>
                    <Button
                      buttonStyle="secondary"
                      className={styles.payloadButton}
                      onClick={() => {
                        setExternalImageURLValue('')
                        setSelectedSymbolTitle(null)
                        setMedia(null)
                      }}
                      size="small"
                      type="button"
                    >
                      Eemalda sümbol
                    </Button>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
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
