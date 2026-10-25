import {
  Check,
  Grid3X3,
  Home,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  MousePointer2,
  Play,
  Puzzle,
  ShieldCheck,
  Volume2,
  X,
} from 'lucide-react'

import { ButtonLink, Eyebrow, LogoTile, SectionIntro, toneAt } from '@/components/Brand'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SuhtlejaHomepageBlock as SuhtlejaHomepageProps } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { cn } from '@/utilities/ui'

import { homepageDefaults, rowsOr, textOr } from './defaults'
import { AboutSection } from './sections/AboutSection'
import { AudienceSection } from './sections/AudienceSection'
import { ClosingSection } from './sections/ClosingSection'
import { FaqSection } from './sections/FaqSection'
import { ListenSection } from './sections/ListenSection'
import { PricingSection } from './sections/PricingSection'
import { StepsSection } from './sections/StepsSection'
import { isMediaObject, MediaFrame } from './ui'

type Props = SuhtlejaHomepageProps & {
  className?: string
}

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

const heroBadgeIcons = [Volume2, Lock, ImageIcon]

// Where each floating label sits around the hero image on large screens: on the device
// edges, clear of the middle of the screenshot.
const heroBadgePositions = [
  'lg:absolute lg:-left-6 lg:top-6',
  'lg:absolute lg:-right-2 lg:bottom-8',
  'lg:absolute lg:-bottom-5 lg:left-10',
]

const featureIcons = [Grid3X3, Puzzle, ShieldCheck, Home]

export const SuhtlejaHomepageBlock: React.FC<Props> = ({
  className,
  hero,
  video,
  audience,
  listen,
  steps,
  features,
  about,
  pricing,
  faq,
  closing,
}) => {
  const featureItems = features?.items ?? []
  // Highlights have no fallback: the floating labels already carry the short selling points.
  const highlights = hero?.highlights?.map((item) => item.text) ?? []
  const badges = rowsOr(
    hero?.badges?.map((item) => item.text),
    homepageDefaults.hero.badges,
  )

  // Negative margins cancel FrontendShell's padding, so sections run edge to edge and the
  // closing band meets the footer.
  return (
    <section className={cn('not-prose overflow-hidden bg-white text-[#22314c] -mx-4 -mt-[144px] -mb-10 sm:-mt-[167px]', className)}>
      {hero?.enabled !== false && <div className="relative isolate border-b border-[#e6ebf3] bg-[#f8fafc] pt-[144px] sm:pt-[167px]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-14 pb-24 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="max-w-2xl">
            <div className="mt-8">
              <Eyebrow tone="orange">{hero?.eyebrow}</Eyebrow>
            </div>
            <h1 className="mt-5 text-balance font-display text-[2.6rem] font-black leading-[1.02] tracking-[-0.015em] text-[#22314c] sm:text-6xl lg:text-[4.1rem]">
              {hero?.title}
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-[#56627a] sm:text-lg">
              {hero?.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={hero?.primaryCta?.href} label={hero?.primaryCta?.label} />
              <ButtonLink href={hero?.secondaryCta?.href} label={hero?.secondaryCta?.label} variant="secondary" />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#56627a]">{textOr(hero?.note, homepageDefaults.hero.note)}</p>
            {!!highlights.length && <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#344259]">
              {highlights.map((text, index) => (
                <li key={`${index}-${text}`} className="flex items-center gap-2">
                  <Check aria-hidden="true" className="h-4 w-4 flex-none text-[#1c79dd]" />
                  {text}
                </li>
              ))}
            </ul>}
          </div>

          <div className="relative isolate">
            {/* The logo's three tiles, enlarged and set behind the product image. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
              {/* On load the tiles drop into place one after another, like tiles set on a board. */}
              <span className="absolute -left-8 top-2 h-44 w-44 -rotate-6 rounded-[40px] bg-[#ffe2bd] motion-safe:animate-tile-drop" />
              <span className="absolute -top-6 right-16 h-28 w-28 rotate-6 rounded-[28px] bg-[#fdd5d1] motion-safe:animate-tile-drop [animation-delay:120ms]" />
              <span className="absolute -bottom-8 -right-8 h-64 w-64 -rotate-3 rounded-[56px] bg-[#d5e8fc] motion-safe:animate-tile-drop [animation-delay:240ms]" />
            </div>
            {/* Contain so device mockups are never cropped at the frame edges. */}
            <MediaFrame
              resource={hero?.image}
              label="Hero Product Image"
              // The fallback mockup needs its full height; a real screenshot gets a 4:3 frame on
              // small screens so the device isn't surrounded by empty space.
              className={
                isMediaObject(hero?.image) ? 'aspect-[4/3] w-full lg:aspect-auto lg:min-h-[440px]' : 'min-h-[440px]'
              }
              imageFit="contain"
              priority
            >
              <HeroMockup />
            </MediaFrame>
            {/* lg:contents lets each label position itself against the image frame. */}
            <ul className="mt-4 flex flex-wrap gap-2 lg:contents">
              {badges.map((text, index) => {
                const Icon = heroBadgeIcons[index % heroBadgeIcons.length]
                return (
                  <li
                    key={`${index}-${text}`}
                    className={cn(
                      'inline-flex items-center gap-2.5 rounded-full bg-white py-2 pl-2.5 pr-4 text-sm font-bold text-[#22314c] shadow-[0_12px_30px_rgba(34,49,76,0.16)] ring-1 ring-[#e6ebf3]',
                      heroBadgePositions[index % heroBadgePositions.length],
                      'motion-safe:animate-pop-in',
                    )}
                    // Labels pop in after the tiles have landed.
                    style={{ animationDelay: `${450 + index * 140}ms` }}
                  >
                    <LogoTile index={index} size="sm">
                      <Icon />
                    </LogoTile>
                    {text}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>}

      {video?.enabled !== false && <div className="mx-auto max-w-7xl px-4 py-20 sm:py-24" id="video">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <Eyebrow tone="red">{video?.eyebrow}</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-balance font-display text-[2rem] font-black leading-[1.08] tracking-[-0.01em] sm:text-[2.6rem]">
              {video?.title}
            </h2>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-8 text-[#56627a]">{video?.description}</p>
          </div>

          <VideoDialog video={video} />
        </div>
      </div>}

      {audience?.enabled !== false && <AudienceSection audience={audience} />}

      {listen?.enabled !== false && <ListenSection listen={listen} />}

      {steps?.enabled !== false && <StepsSection steps={steps} />}

      {features?.enabled !== false && <div className="bg-[#f8fafc] py-20 sm:py-24" id="voimalused">
        <div className="mx-auto max-w-7xl px-4">
          <SectionIntro eyebrow={features?.eyebrow} title={features?.title} description={features?.description} />

          {!!featureItems.length && (
            <Tabs defaultValue="feature-0" className="mt-10">
              <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                {featureItems.map((item, index) => (
                  <TabsTrigger
                    key={item.id ?? item.title}
                    value={`feature-${index}`}
                    className={cn(
                      'gap-2.5 rounded-[14px] border-[3px] border-[#e1e6ef] bg-white px-4 py-2.5 font-display text-base font-extrabold text-[#22314c] data-[state=active]:text-[#22314c] data-[state=active]:shadow-none',
                      toneAt(index).activeTab,
                    )}
                  >
                    <span aria-hidden="true" className={cn('h-3 w-3 -rotate-6 rounded-[3px]', toneAt(index).solid)} />
                    {item.title}
                  </TabsTrigger>
                ))}
              </TabsList>

              {featureItems.map((item, index) => {
                const Icon = featureIcons[index % featureIcons.length]

                return (
                  // forceMount keeps every feature in the server HTML; inactive panels are hidden with CSS.
                  <TabsContent
                    key={item.id ?? item.title}
                    value={`feature-${index}`}
                    forceMount
                    className="mt-8 data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-fade-up"
                  >
                    <div className="grid items-center gap-8 rounded-[32px] bg-white p-5 shadow-[0_20px_50px_rgba(34,49,76,0.08)] sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                      <div className="max-w-xl">
                        <LogoTile index={index}>
                          <Icon />
                        </LogoTile>
                        <h3 className="mt-6 font-display text-2xl font-black sm:text-3xl">{item.title}</h3>
                        <p className="mt-4 text-base leading-7 text-[#56627a]">{item.description}</p>
                      </div>

                      <MediaFrame
                        resource={item.image}
                        label={item.imageLabel || item.title}
                        className={cn(
                          'min-h-72 bg-[#f8fafc]',
                          featureImageAspectClass[item.imageAspectRatio || '16/9'],
                        )}
                      >
                        {index === 1 ? <DotsMockup /> : <BoardMockup />}
                      </MediaFrame>
                    </div>
                  </TabsContent>
                )
              })}
            </Tabs>
          )}
        </div>
      </div>}

      {about?.enabled !== false && <AboutSection about={about} />}

      {pricing?.enabled !== false && <PricingSection pricing={pricing} />}

      {faq?.enabled !== false && <FaqSection faq={faq} />}

      {closing?.enabled !== false && <ClosingSection closing={closing} />}
    </section>
  )
}
