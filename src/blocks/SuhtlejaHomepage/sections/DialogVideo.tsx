'use client'

import { useEffect, useRef } from 'react'

// The uploaded video in the homepage video dialog. It starts as soon as the dialog opens: the click
// that opened it counts as the user gesture browsers need for playback with sound. If a browser still
// blocks it, the native controls stay, so the visitor presses play as before.
export function DialogVideo({
  className,
  poster,
  src,
  type,
}: {
  className?: string
  poster?: string
  src: string
  type?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    videoRef.current?.play().catch(() => undefined)
  }, [])

  return (
    <video ref={videoRef} controls playsInline preload="metadata" poster={poster} className={className}>
      <source src={src} type={type} />
      Sinu brauser ei saa seda videot esitada.
    </video>
  )
}
