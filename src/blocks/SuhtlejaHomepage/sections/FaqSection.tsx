import { SectionIntro } from '@/components/Brand'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import type { SuhtlejaHomepageBlock } from '@/payload-types'

import { homepageDefaults, rowsOr, textOr } from '../defaults'

export function FaqSection({ faq }: { faq: SuhtlejaHomepageBlock['faq'] }) {
  const items = rowsOr(faq?.items, homepageDefaults.faq.items)

  return (
    <div className="py-20 sm:py-24" id="kkk">
      <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
        <SectionIntro
          eyebrow={textOr(faq?.eyebrow, homepageDefaults.faq.eyebrow)}
          title={textOr(faq?.title, homepageDefaults.faq.title)}
        />

        <Accordion type="single" collapsible className="border-t-2 border-[#e6ebf3]">
          {items.map((item, index) => (
            <AccordionItem
              key={`${index}-${item.question}`}
              value={`kkk-${index}`}
              className="border-b-2 border-[#e6ebf3]"
            >
              <AccordionTrigger className="gap-4 py-5 font-display text-lg font-extrabold text-[#22314c] hover:no-underline">
                {item.question}
              </AccordionTrigger>
              {/* forceMount keeps closed answers in the server HTML (hidden) for search engines. */}
              <AccordionContent forceMount className="max-w-2xl text-base leading-7 text-[#56627a] data-[state=closed]:hidden">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}
