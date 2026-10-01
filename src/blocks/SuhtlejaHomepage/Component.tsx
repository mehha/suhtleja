import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  Check,
  Grid3X3,
  Home,
  MessageCircle,
  MousePointer2,
  Play,
  Puzzle,
  ShieldCheck,
  Volume2,
  X,
} from 'lucide-react'

import { Media } from '@/components/Media'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { Media as PayloadMedia, SuhtlejaHomepageBlock as SuhtlejaHomepageProps } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { cn } from '@/utilities/ui'

type Props = SuhtlejaHomepageProps & {
  className?: string
}

type MediaResource = PayloadMedia | number | null | undefined
type ImageAspectRatio = NonNullable<
  NonNullable<NonNullable<SuhtlejaHomepageProps['features']>['items']>[number]['imageAspectRatio']
>

const featureImageAspectClass: Record<ImageAspectRatio, string> = {
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '3/2': 'aspect-[3/2]',
  '1/1': 'aspect-square',
  '2/3': 'aspect-[2/3]',
  '9/16': 'aspect-[9/16]',
}

function isMediaObject(resource: MediaResource): resource is PayloadMedia {
  return Boolean(resource && typeof resource === 'object')
}

function appendSearchParams(url: URL, params: Record<string, string>) {
  Object.entries(params).forEach(([key, value]) => {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}

function getVideoEmbedUrl(rawUrl?: string | null) {
  if (!rawUrl) return ''

  try {
    const url = new URL(rawUrl)
    const hostname = url.hostname.replace(/^www\./, '')

    if (hostname === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      if (id) {
        return appendSearchParams(new URL(`https://www.youtube.com/embed/${id}`), {
          playsinline: '1',
          rel: '0',
        })
      }
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      const id =
        url.pathname.startsWith('/embed/')
          ? url.pathname.split('/').filter(Boolean)[1]
          : url.searchParams.get('v')

      if (id) {
        return appendSearchParams(new URL(`https://www.youtube.com/embed/${id}`), {
          playsinline: '1',
          rel: '0',
        })
      }
    }

    if (hostname === 'vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      if (id) {
        return appendSearchParams(new URL(`https://player.vimeo.com/video/${id}`), {
          playsinline: '1',
        })
      }
    }

    if (hostname === 'player.vimeo.com') {
      return appendSearchParams(url, { playsinline: '1' })
    }

    return rawUrl
  } catch {
    return rawUrl
  }
}

function ButtonLink({
  href,
  label,
  variant = 'primary',
}: {
  href?: string | null
  label?: string | null
  variant?: 'primary' | 'secondary'
}) {
  if (!href || !label) return null

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        variant === 'primary'
          ? 'bg-[#22314c] text-white shadow-[0_14px_32px_rgba(34,49,76,0.22)] hover:bg-[#172238] focus-visible:ring-[#22314c]'
          : 'border border-[#d8dde8] bg-white text-[#22314c] hover:border-[#22314c]/35 hover:bg-[#f8fafc] focus-visible:ring-[#1c79dd]',
      )}
    >
      {label}
      {variant === 'primary' ? <ArrowRight className="h-4 w-4" /> : null}
    </Link>
  )
}

function Eyebrow({ children, tone = 'blue' }: { children?: string | null; tone?: 'orange' | 'red' | 'blue' }) {
  if (!children) return null

  const color = tone === 'orange' ? 'bg-[#ff980d]' : tone === 'red' ? 'bg-[#ef4035]' : 'bg-[#1c79dd]'

  return (
    <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#657189]">
      <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
      {children}
    </p>
  )
}

function MediaFrame({
  resource,
  label,
  className,
  children,
}: {
  resource?: MediaResource
  label: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[28px]',
        className,
      )}
    >
      {isMediaObject(resource) ? (
        <Media
          resource={resource}
          fill
          pictureClassName="block h-full w-full"
          imgClassName="object-cover"
          videoClassName="h-full w-full object-cover"
        />
      ) : (
        children ?? (
          <div className="flex h-full min-h-64 items-center justify-center bg-[#f6f8fb] p-8 text-center text-sm font-semibold text-[#657189]">
            {label}
          </div>
        )
      )}
    </div>
  )
}

function VideoDialog({ video }: { video?: SuhtlejaHomepageProps['video'] }) {
  const videoFile = isMediaObject(video?.videoFile) ? video.videoFile : null
  const videoSrc = getMediaUrl(videoFile?.url, videoFile?.updatedAt)
  const embedUrl = getVideoEmbedUrl(video?.embedUrl)
  const posterMedia = isMediaObject(video?.poster) ? video.poster : null
  const posterUrl = getMediaUrl(posterMedia?.url, posterMedia?.updatedAt)
  const hasVideo = Boolean(embedUrl || videoSrc)

  const poster = (
    <div className="relative">
      <MediaFrame
        resource={video?.poster}
        label={video?.placeholderLabel || 'Video lisandub peagi'}
        className="aspect-video"
      >
        <div className="flex h-full min-h-72 items-center justify-center bg-[#f7f9fd] p-8 text-center">
          <p className="text-lg font-extrabold text-[#22314c]">
            {video?.placeholderLabel || 'Video lisandub peagi'}
          </p>
        </div>
      </MediaFrame>
      <span className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-[#22314c]/10 transition group-hover:bg-[#22314c]/16">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-[#22314c] shadow-[0_18px_42px_rgba(34,49,76,0.3)] transition group-hover:scale-105">
          <Play className="ml-1 h-9 w-9 fill-current" />
        </span>
      </span>
    </div>
  )

  if (!hasVideo) return poster

  return (
    <Dialog>
      <DialogTrigger
        className="group block w-full rounded-[28px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1c79dd] focus-visible:ring-offset-4"
        aria-label={video?.title ? `Ava video: ${video.title}` : 'Ava video'}
      >
        {poster}
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,1040px)] max-w-none border-0 bg-transparent p-0 shadow-none [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">{video?.title || 'Suhtleja video'}</DialogTitle>
        <DialogClose className="absolute -right-3 -top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#22314c] shadow-[0_12px_30px_rgba(15,23,42,0.28)] transition hover:bg-[#f8fafc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1c79dd] focus-visible:ring-offset-2">
          <X className="h-5 w-5" />
          <span className="sr-only">Sulge video</span>
        </DialogClose>
        <div className="overflow-hidden rounded-[28px] bg-black shadow-2xl">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={video?.title || 'Suhtleja video'}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <video
              controls
              playsInline
              preload="metadata"
              poster={posterUrl || undefined}
              className="max-h-[82svh] w-full bg-black"
            >
              <source src={videoSrc} type={videoFile?.mimeType || undefined} />
              Sinu brauser ei saa seda videot esitada.
            </video>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function HeroMockup() {
  const tiles = [
    { label: 'Minu tahvel', icon: MessageCircle, color: 'bg-[#ff980d]' },
    { label: 'Punktimäng', icon: Puzzle, color: 'bg-[#1c79dd]' },
    { label: 'Tunded', icon: ShieldCheck, color: 'bg-[#ef4035]' },
    { label: 'Õues', icon: Home, color: 'bg-[#34b27b]' },
  ]

  return (
    <div className="h-full min-h-[440px] bg-[#f7f9fd] p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#657189]">Lapse koduvaade</p>
          <h3 className="mt-1 text-2xl font-extrabold text-[#22314c]">Tere!</h3>
        </div>
        <div className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#22314c] shadow-sm">PIN</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <div
              key={tile.label}
              className="flex min-h-[150px] flex-col justify-between rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-[#dfe5f0]"
            >
              <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl text-white', tile.color)}>
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-lg font-extrabold text-[#22314c]">{tile.label}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 rounded-[22px] bg-[#22314c] p-4 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">Järgmine tegevus</p>
        <p className="mt-1 text-lg font-bold">Vali pilt ja kuula sõna</p>
      </div>
    </div>
  )
}

function BoardMockup() {
  const cells = [
    ['juua', 'bg-[#eaf5ff]', 'text-[#1359b7]'],
    ['süüa', 'bg-[#fff4dc]', 'text-[#cc6700]'],
    ['mängida', 'bg-[#ffe9e7]', 'text-[#bf1f2b]'],
    ['veel', 'bg-[#e9f8f1]', 'text-[#19724f]'],
    ['aitäh', 'bg-[#eef1f7]', 'text-[#22314c]'],
    ['valmis', 'bg-[#f9edf8]', 'text-[#8a397e]'],
  ]

  return (
    <div className="grid h-full min-h-72 grid-cols-2 gap-3 bg-[#f7f9fd] p-4 sm:grid-cols-3">
      {cells.map(([label, bg, text], index) => (
        <div
          key={label}
          className={cn(
            'flex min-h-24 flex-col items-center justify-center gap-2 rounded-[20px] border bg-white p-3 text-center shadow-sm',
            index === 1 ? 'scale-[0.98] border-[#ff980d] ring-4 ring-[#ff980d]/15' : 'border-[#dfe5f0]',
          )}
        >
          <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', bg, text)}>
            {index === 0 ? <Volume2 className="h-6 w-6" /> : <MousePointer2 className="h-6 w-6" />}
          </span>
          <span className="text-base font-extrabold text-[#22314c]">{label}</span>
        </div>
      ))}
    </div>
  )
}

function DotsMockup() {
  const dots = [
    ['18%', '70%'],
    ['30%', '45%'],
    ['48%', '62%'],
    ['62%', '34%'],
    ['78%', '58%'],
  ]

  return (
    <div className="relative h-full min-h-72 overflow-hidden bg-[#f7fbff] p-4">
      <div className="absolute left-4 top-4 z-10 rounded-full bg-white/90 p-2 text-[#22314c] shadow-sm">
        <Volume2 className="h-5 w-5" />
      </div>
      <div className="absolute inset-x-12 bottom-8 top-8 rounded-full bg-[#ffe1a8]" />
      <div className="absolute bottom-16 left-[27%] h-24 w-24 rounded-full bg-[#ff980d]" />
      <div className="absolute bottom-20 right-[24%] h-28 w-28 rounded-full bg-[#1c79dd]" />
      <div className="absolute left-[38%] top-14 h-24 w-28 rounded-full bg-[#ef4035]" />
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <polyline
          points="18,70 30,45 48,62 62,34 78,58"
          vectorEffect="non-scaling-stroke"
          fill="none"
          stroke="#22314c"
          strokeDasharray="6 8"
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
      {dots.map(([left, top], index) => (
        <span
          key={`${left}-${top}`}
          className="absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-extrabold text-[#22314c] shadow-[0_8px_20px_rgba(34,49,76,0.18)] ring-4 ring-[#1c79dd]/20"
          style={{ left, top }}
        >
          {index + 1}
        </span>
      ))}
    </div>
  )
}

export const SuhtlejaHomepageBlock: React.FC<Props> = ({ className, hero, video, features, audience }) => {
  const featureItems = features?.items ?? []
  const audienceItems = audience?.items ?? []
  const showHero = hero?.enabled !== false
  const showVideo = video?.enabled !== false
  const showFeatures = features?.enabled !== false
  const showAudience = audience?.enabled !== false

  return (
    <section className={cn('not-prose overflow-hidden bg-white text-[#22314c] -mx-4 -mt-[167px]', className)}>
      {showHero && <div className="relative isolate border-b border-[#e6ebf3] bg-[#f8fafc] pt-[167px]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_18%,rgba(28,121,221,0.14),transparent_32%),radial-gradient(circle_at_18%_28%,rgba(255,152,13,0.16),transparent_28%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-14 pb-24 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="max-w-2xl">
            <div className="mt-8">
              <Eyebrow tone="orange">{hero?.eyebrow}</Eyebrow>
            </div>
            <h1 className="mt-5 text-balance text-4xl font-black leading-[1.02] tracking-normal text-[#22314c] sm:text-5xl lg:text-6xl">
              {hero?.title}
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-[#56627a] sm:text-lg">
              {hero?.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={hero?.primaryCta?.href} label={hero?.primaryCta?.label} />
              <ButtonLink href={hero?.secondaryCta?.href} label={hero?.secondaryCta?.label} variant="secondary" />
            </div>
            {!!hero?.highlights?.length && (
              <div className="mt-8 grid gap-3 text-sm font-semibold text-[#344259] sm:grid-cols-3">
                {hero.highlights.map((item) => (
                  <div key={item.id ?? item.text} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-none text-[#1c79dd]" />
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <MediaFrame resource={hero?.image} label="Hero Product Image" className="min-h-[440px]">
            <HeroMockup />
          </MediaFrame>
        </div>
      </div>}

      {showVideo && <div className="mx-auto max-w-7xl px-4 py-20" id="video">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <Eyebrow tone="red">{video?.eyebrow}</Eyebrow>
            <h2 className="mt-4 max-w-2xl text-balance text-3xl font-black leading-tight tracking-normal sm:text-4xl">
              {video?.title}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#56627a]">{video?.description}</p>
          </div>

          <VideoDialog video={video} />
        </div>
      </div>}

      {showFeatures && <div className="bg-[#f8fafc] py-20" id="voimalused">
        <div className="mx-auto max-w-7xl px-4">
          <div className="max-w-3xl">
            <Eyebrow>{features?.eyebrow}</Eyebrow>
            <h2 className="mt-4 text-balance text-3xl font-black leading-tight tracking-normal sm:text-4xl">
              {features?.title}
            </h2>
            <p className="mt-5 text-base leading-7 text-[#56627a]">{features?.description}</p>
          </div>

          <div className="mt-12 grid gap-10">
            {featureItems.map((item, index) => (
              <article
                key={item.id ?? item.title}
                className={cn(
                  'grid items-center gap-8 lg:grid-cols-2',
                  index % 2 === 1 && 'lg:[&>*:first-child]:order-2',
                )}
              >
                <div className="max-w-xl">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#1c79dd] shadow-sm ring-1 ring-[#dfe5f0]">
                    {index === 0 ? <Grid3X3 className="h-6 w-6" /> : index === 1 ? <Puzzle className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                  </div>
                  <h3 className="text-2xl font-black tracking-normal sm:text-3xl">{item.title}</h3>
                  <p className="mt-4 text-base leading-7 text-[#56627a]">{item.description}</p>
                </div>

                <MediaFrame
                  resource={item.image}
                  label={item.imageLabel || item.title}
                  className={cn(
                    'min-h-72',
                    featureImageAspectClass[item.imageAspectRatio || '16/9'],
                  )}
                >
                  {index === 1 ? <DotsMockup /> : <BoardMockup />}
                </MediaFrame>
              </article>
            ))}
          </div>
        </div>
      </div>}

      {showAudience && <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div>
          <h2 className="text-balance text-3xl font-black leading-tight tracking-normal sm:text-4xl">{audience?.title}</h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#56627a]">{audience?.description}</p>
          {!!audienceItems.length && (
            <div className="mt-8 grid gap-4">
              {audienceItems.map((item) => (
                <div key={item.id ?? item.text} className="flex items-start gap-3 text-sm font-semibold text-[#344259]">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#eaf5ff] text-[#1c79dd]">
                    <Check className="h-4 w-4" />
                  </span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-9">
            <ButtonLink href={audience?.cta?.href} label={audience?.cta?.label} />
          </div>
        </div>

        <MediaFrame resource={audience?.image} label="Kodus, lasteaias, koolis ja teraapias" className="min-h-[420px]">
          <div className="flex h-full min-h-[420px] flex-col justify-between bg-[#f7f9fd] p-6">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#22314c] shadow-sm">Koduvaade</span>
              <span className="rounded-full bg-[#eaf5ff] px-4 py-2 text-sm font-bold text-[#1c79dd]">Vanemavaade</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-[#dfe5f0]">
                <MessageCircle className="h-10 w-10 text-[#ff980d]" />
                <p className="mt-8 text-xl font-black">Tahvlid</p>
              </div>
              <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-[#dfe5f0]">
                <Puzzle className="h-10 w-10 text-[#1c79dd]" />
                <p className="mt-8 text-xl font-black">Mängud</p>
              </div>
            </div>
            <div className="rounded-[24px] bg-[#22314c] p-5 text-white">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/50">Rahulik ekraan</p>
              <p className="mt-2 text-2xl font-black">Sisu lapse tempos</p>
            </div>
          </div>
        </MediaFrame>
      </div>}
    </section>
  )
}
