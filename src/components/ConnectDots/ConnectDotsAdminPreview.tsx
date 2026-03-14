'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { CheckCircle2, Eye, MousePointer2, PencilLine, RefreshCw, Undo2 } from 'lucide-react'
import type { ConnectDotsPuzzle, ConnectDotsCountMode, ConnectDotsInteractionMode } from '@/utilities/connectDots'
import {
  CONNECT_DOTS_COUNT_MODE_OPTIONS,
  CONNECT_DOTS_INTERACTION_MODE_OPTIONS,
  distanceBetweenPoints,
  getContainedImageRect,
  getConnectDotsLabel,
  getNormalizedPointFromContainedRect,
  getRevealOpacity,
} from '@/utilities/connectDots'
import styles from './ConnectDotsAdmin.module.css'

const TRACE_RADIUS = 0.05

type Props = {
  puzzle: ConnectDotsPuzzle
}

type PointerPosition = {
  x: number
  y: number
}

export function ConnectDotsAdminPreview({ puzzle }: Props) {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 })
  const [countMode, setCountMode] = useState<ConnectDotsCountMode>('count-1')
  const [interactionMode, setInteractionMode] = useState<ConnectDotsInteractionMode>('click')
  const [visitedIndexes, setVisitedIndexes] = useState<number[]>([0])
  const [traceActive, setTraceActive] = useState(false)
  const [pointerPosition, setPointerPosition] = useState<PointerPosition | null>(null)

  const totalDots = puzzle.dots.length
  const finished = visitedIndexes.length >= totalDots
  const currentIndex = visitedIndexes[visitedIndexes.length - 1] ?? 0
  const nextIndex = currentIndex + 1
  const currentDot = puzzle.dots[currentIndex] ?? null
  const nextDot = puzzle.dots[nextIndex] ?? null
  const revealOpacity = getRevealOpacity(visitedIndexes.length, totalDots)
  const imageAspectRatio =
    puzzle.imageWidth && puzzle.imageHeight ? `${puzzle.imageWidth} / ${puzzle.imageHeight}` : '4 / 3'
  const renderRect = getContainedImageRect(
    boardSize.width,
    boardSize.height,
    puzzle.imageWidth,
    puzzle.imageHeight,
  )
  const svgWidth = Math.max(renderRect.width, 1)
  const svgHeight = Math.max(renderRect.height, 1)

  useEffect(() => {
    if (!boardRef.current) {
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
  }, [])

  const segments = useMemo(() => {
    return visitedIndexes.slice(1).map((visitedIndex) => ({
      from: puzzle.dots[visitedIndex - 1],
      key: `${visitedIndex - 1}-${visitedIndex}`,
      to: puzzle.dots[visitedIndex],
    }))
  }, [puzzle.dots, visitedIndexes])

  const reset = () => {
    setVisitedIndexes([0])
    setTraceActive(false)
    setPointerPosition(null)
  }

  const undo = () => {
    if (visitedIndexes.length <= 1) {
      return
    }

    setVisitedIndexes((current) => current.slice(0, -1))
    setTraceActive(false)
    setPointerPosition(null)
  }

  const advanceTo = (index: number) => {
    setVisitedIndexes((current) => {
      const currentIndex = current[current.length - 1] ?? 0

      if (current.length >= totalDots || index !== currentIndex + 1 || current.includes(index)) {
        return current
      }

      return [...current, index]
    })
  }

  const getBoardPosition = (event: ReactPointerEvent<HTMLDivElement>): PointerPosition | null => {
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

  const handleTraceStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionMode !== 'trace' || !currentDot) {
      return
    }

    const position = getBoardPosition(event)
    if (!position) {
      return
    }

    setPointerPosition(position)

    if (distanceBetweenPoints(position, currentDot) > TRACE_RADIUS) {
      return
    }

    boardRef.current?.setPointerCapture(event.pointerId)
    setTraceActive(true)
  }

  const handleTraceMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionMode !== 'trace') {
      return
    }

    const position = getBoardPosition(event)
    if (!position) {
      return
    }

    setPointerPosition(position)

    if (!traceActive || !nextDot || finished) {
      return
    }

    if (distanceBetweenPoints(position, nextDot) <= TRACE_RADIUS) {
      advanceTo(nextIndex)
    }
  }

  const handleTraceEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (boardRef.current?.hasPointerCapture(event.pointerId)) {
      boardRef.current.releasePointerCapture(event.pointerId)
    }

    setTraceActive(false)
    setPointerPosition(null)
  }

  return (
    <div className={styles.previewShell}>
      <div className={styles.previewToolbar}>
        <div className={styles.modePanel}>
          <p className={styles.modeTitle}>
            <PencilLine size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            Loendus
          </p>
          <div className={styles.modeRow}>
            {CONNECT_DOTS_COUNT_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`${styles.modeButton} ${countMode === option.value ? styles.modeButtonActive : ''}`}
                onClick={() => setCountMode(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.modePanel}>
          <p className={styles.modeTitle}>
            <MousePointer2 size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            Mänguviis
          </p>
          <div className={styles.modeRow}>
            {CONNECT_DOTS_INTERACTION_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`${styles.modeButton} ${interactionMode === option.value ? styles.modeButtonActive : ''}`}
                onClick={() => {
                  setInteractionMode(option.value)
                  setTraceActive(false)
                  setPointerPosition(null)
                }}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.modePanel}>
          <p className={styles.modeTitle}>
            <Eye size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            Eelvaate tegevused
          </p>
          <div className={styles.modeRow}>
            <button className={styles.modeButton} onClick={reset} type="button">
              <RefreshCw size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              Alusta uuesti
            </button>
            <button
              className={styles.modeButton}
              disabled={visitedIndexes.length <= 1}
              onClick={undo}
              type="button"
            >
              <Undo2 size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              Võta tagasi
            </button>
          </div>
        </div>
      </div>

      <div
        ref={boardRef}
        className={styles.previewBoard}
        style={{ aspectRatio: imageAspectRatio }}
        onPointerDown={handleTraceStart}
        onPointerMove={handleTraceMove}
        onPointerLeave={() => {
          if (!traceActive) {
            setPointerPosition(null)
          }
        }}
        onPointerUp={handleTraceEnd}
      >
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
            alt={puzzle.imageAlt || puzzle.title}
            className={styles.image}
            draggable={false}
            src={puzzle.imageUrl}
            style={{ opacity: revealOpacity }}
          />
          <div className={styles.imageOverlay} />

          <svg
            className={styles.svg}
            preserveAspectRatio="none"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          >
          {segments.map((segment) => (
            <line
              key={segment.key}
              stroke="rgba(0, 0, 0, 0.52)"
              strokeLinecap="round"
              strokeWidth="7"
              x1={segment.from.x * svgWidth}
              x2={segment.to.x * svgWidth}
              y1={segment.from.y * svgHeight}
              y2={segment.to.y * svgHeight}
            />
          ))}

          {traceActive && currentDot && pointerPosition && !finished ? (
            <line
              stroke="rgba(0, 0, 0, 0.38)"
              strokeDasharray="18 16"
              strokeLinecap="round"
              strokeWidth="5"
              x1={currentDot.x * svgWidth}
              x2={pointerPosition.x * svgWidth}
              y1={currentDot.y * svgHeight}
              y2={pointerPosition.y * svgHeight}
            />
          ) : null}

          {puzzle.dots.map((dot, index) => {
            const isStart = index === 0
            const visited = visitedIndexes.includes(index)
            const next = index === nextIndex && !finished
            const dotX = dot.x * svgWidth
            const dotY = dot.y * svgHeight

            return (
              <g
                key={`${puzzle.id}-${index}`}
                onClick={() => {
                  if (interactionMode === 'click') {
                    advanceTo(index)
                  }
                }}
                style={{ cursor: interactionMode === 'click' && !finished ? 'pointer' : 'default' }}
              >
                <circle
                  cx={dotX}
                  cy={dotY}
                  fill="transparent"
                  r="18"
                />
                {isStart ? (
                  <circle
                    cx={dotX}
                    cy={dotY}
                    fill="none"
                    r="11"
                    stroke="rgba(17, 24, 39, 0.38)"
                    strokeWidth="1.5"
                  />
                ) : null}
                <circle
                  cx={dotX}
                  cy={dotY}
                  fill={visited ? 'rgba(0, 0, 0, 0.18)' : '#ffffff'}
                  r="8"
                  stroke="#111827"
                  strokeWidth={next ? '3' : '2'}
                />
                {next ? <circle cx={dotX} cy={dotY} fill="#111827" r="2.2" /> : null}
                <text
                  fill="#0f172a"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontSize="11"
                  fontWeight="700"
                  x={dotX + 12}
                  y={dotY - 10}
                >
                  {getConnectDotsLabel(countMode, index)}
                </text>
              </g>
            )
          })}
          </svg>
        </div>
      </div>

      <div className={styles.statusBar}>
        {finished ? (
          <span className={styles.statusDone}>
            <CheckCircle2 size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            Eelvaade on valmis. Pilt on täielikult nähtav.
          </span>
        ) : (
          <>
            Järgmine punkt:
            <strong style={{ color: '#0f172a', marginLeft: 6 }}>
              {nextDot ? getConnectDotsLabel(countMode, nextIndex) : 'Valmis'}
            </strong>
          </>
        )}
      </div>
    </div>
  )
}
