import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { ArchiveBlock } from '@/blocks/ArchiveBlock/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { ContentBlock } from '@/blocks/Content/Component'
import { FormBlock } from '@/blocks/Form/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { HeroPawsBlock } from '@/blocks/HeroPaws/Component'
import { AacFeaturesBlock } from '@/blocks/AacFeatures/Component'
import { UsageContextsBlockComponent } from '@/blocks/UsageContexts/Component'
import { SuhtlejaHomepageBlock } from '@/blocks/SuhtlejaHomepage/Component'
import { HowItWorksBlock } from '@/blocks/HowItWorks/Component'
import { ContactBlock } from '@/blocks/Contact/Component'

const blockComponents = {
  archive: ArchiveBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  formBlock: FormBlock,
  mediaBlock: MediaBlock,
  heroPaws: HeroPawsBlock,
  'aac-features': AacFeaturesBlock,
  usageContexts: UsageContextsBlockComponent,
  suhtlejaHomepage: SuhtlejaHomepageBlock,
  howItWorks: HowItWorksBlock,
  contact: ContactBlock,
}

export const RenderBlocks: React.FC<{
  blocks: Page['layout'][0][]
  /** The first block opens with the page title; it renders that heading as the h1. */
  promoteFirstHeading?: boolean
}> = (props) => {
  const { blocks, promoteFirstHeading = false } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block


          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType]

            if (Block) {
              return (
                <div className="mb-16 last:mb-0" key={index}>
                  {/* @ts-expect-error there may be some mismatch between the expected types here */}
                  <Block {...block} disableInnerContainer {...(promoteFirstHeading && index === 0 ? { promoteHeading: true } : {})} />
                </div>
              )
            }
          }
          return null
        })}
      </Fragment>
    )
  }

  return null
}
