import { Blocks, Check, GlassWater, Heart, MessageCircle, Plus, Utensils } from 'lucide-react'

import { SectionIntro, toneAt } from '@/components/Brand'
import type { SuhtlejaHomepageBlock } from '@/payload-types'
import { buildHomepageSpeechURL } from '@/utilities/homepageSpeech'
import { cn } from '@/utilities/ui'

import { homepageDefaults, textOr } from '../defaults'
import { MediaFrame, type MediaResource } from '../ui'
import { SpeakTile, SpeechBoard } from './ListenTiles'

// Icons for the fallback words, in the same order as homepageDefaults.listen.tiles.
const fallbackIcons = [GlassWater, Utensils, Blocks, Plus, Heart, Check]

type Tile = {
  id: string
  label: string
  image?: MediaResource
  icon?: typeof MessageCircle
}

export function ListenSection({ listen }: { listen: SuhtlejaHomepageBlock['listen'] }) {
  // Same filtering as getListenLabels, which decides what the speech route will speak.
  const storedTiles: Tile[] = (listen?.tiles ?? [])
    .filter((tile) => tile.label?.trim())
    .map((tile, index) => ({ id: tile.id ?? `tile-${index}`, label: tile.label.trim(), image: tile.image }))
  const tiles: Tile[] = storedTiles.length
    ? storedTiles
    : homepageDefaults.listen.tiles.map((label, index) => ({
        id: `default-${index}`,
        label,
        icon: fallbackIcons[index],
      }))

  return (
    <div className="bg-[#fff4e5] py-20 sm:py-24" id="kuula">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <SectionIntro
          eyebrow={textOr(listen?.eyebrow, homepageDefaults.listen.eyebrow)}
          title={textOr(listen?.title, homepageDefaults.listen.title)}
          description={textOr(listen?.description, homepageDefaults.listen.description)}
          tone="orange"
        />

        <div className="mx-auto w-full max-w-2xl">
          <SpeechBoard>
            <ul className={cn('grid grid-cols-3 gap-2 sm:gap-3', tiles.length > 6 && 'sm:grid-cols-4')}>
              {tiles.map((tile, index) => {
                const tone = toneAt(index)
                const Icon = tile.icon ?? MessageCircle

                return (
                  <li key={tile.id}>
                    <SpeakTile
                      id={tile.id}
                      src={buildHomepageSpeechURL(tile.label)}
                      label={tile.label}
                      borderClassName={tone.border}
                      playingClassName={tone.soft}
                    >
                      {tile.image && typeof tile.image === 'object' ? (
                        <MediaFrame
                          resource={tile.image}
                          label={tile.label}
                          className="aspect-[4/3] w-full rounded-[10px]"
                          imageFit="contain"
                        />
                      ) : (
                        <span className={cn('flex aspect-[4/3] w-full items-center justify-center', tone.text)}>
                          <Icon aria-hidden="true" className="h-10 w-10 sm:h-12 sm:w-12" strokeWidth={1.75} />
                        </span>
                      )}
                    </SpeakTile>
                  </li>
                )
              })}
            </ul>
          </SpeechBoard>
        </div>
      </div>
    </div>
  )
}
