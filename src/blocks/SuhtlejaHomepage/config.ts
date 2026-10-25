import type { Block, Field } from 'payload'

import { homepageDefaults as d } from './defaults'

const mediaField = (name: string, label: string): Field => ({
  name,
  label,
  type: 'upload',
  relationTo: 'media',
  required: false,
})

const enabledField: Field = {
  name: 'enabled',
  label: 'Kuva sektsioon',
  type: 'checkbox',
  defaultValue: true,
}

// Fields below fall back to `homepageDefaults` when empty; the placeholder shows that text.
const fallbackText = (
  name: string,
  placeholder: string,
  options: { label?: string; type?: 'text' | 'textarea' } = {},
): Field =>
  options.type === 'textarea'
    ? { name, label: options.label, type: 'textarea', admin: { placeholder } }
    : { name, label: options.label, type: 'text', admin: { placeholder } }

const fallbackLink = (name: string, label: string, fallback: { label: string; href: string }): Field => ({
  name,
  label,
  type: 'group',
  fields: [fallbackText('label', fallback.label), fallbackText('href', fallback.href)],
})

const fallbackGroupDescription =
  'Tühjad väljad kuvavad vaikimisi teksti, mida näed väljade kohatäitena.'
const fallbackListDescription = 'Kui loend on tühi, kuvatakse vaikimisi sisu.'

const textPairFields: Field[] = [
  {
    name: 'title',
    type: 'text',
    required: true,
  },
  {
    name: 'description',
    type: 'textarea',
    required: true,
  },
]

export const SuhtlejaHomepage: Block = {
  slug: 'suhtlejaHomepage',
  interfaceName: 'SuhtlejaHomepageBlock',
  labels: {
    singular: 'Suhtleja avaleht',
    plural: 'Suhtleja avalehed',
  },
  fields: [
    {
      name: 'hero',
      label: 'Hero',
      type: 'group',
      fields: [
        {
          name: 'enabled',
          label: 'Kuva sektsioon',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'eyebrow',
          type: 'text',
          defaultValue: 'Eestikeelne suhtluse ja harjutamise keskkond',
        },
        {
          name: 'title',
          type: 'text',
          required: true,
          defaultValue: 'Suhtleja aitab lapsel piltide, heli ja mängu kaudu suhelda',
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          defaultValue:
            'Eestikeelne keskkond suhtlustahvlite ja lihtsate õppemängude loomiseks. Laps saab turvalises vaates valida pilte, kuulata sõnu ja harjutada oskusi omas tempos.',
        },
        mediaField('image', 'Hero tootepilt või mockup'),
        {
          name: 'primaryCta',
          label: 'Põhinupp',
          type: 'group',
          fields: [
            { name: 'label', type: 'text', defaultValue: 'Proovi tasuta' },
            { name: 'href', type: 'text', defaultValue: '/register' },
          ],
        },
        {
          name: 'secondaryCta',
          label: 'Teine nupp',
          type: 'group',
          fields: [
            { name: 'label', type: 'text', defaultValue: 'Vaata võimalusi' },
            { name: 'href', type: 'text', defaultValue: '#voimalused' },
          ],
        },
        fallbackText('note', d.hero.note, { label: 'Märkus nuppude all' }),
        {
          name: 'highlights',
          label: 'Lühiväärtused',
          type: 'array',
          maxRows: 4,
          admin: { description: 'Kuvatakse nuppude all ainult siis, kui lisad vähemalt ühe rea.' },
          fields: [{ name: 'text', type: 'text', required: true }],
        },
        {
          name: 'badges',
          label: 'Sildid pildi kohal',
          type: 'array',
          maxRows: 3,
          admin: { description: fallbackListDescription },
          fields: [{ name: 'text', type: 'text', required: true }],
        },
      ],
    },
    {
      name: 'video',
      label: 'Video sektsioon',
      type: 'group',
      fields: [
        {
          name: 'enabled',
          label: 'Kuva sektsioon',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'eyebrow',
          type: 'text',
          defaultValue: 'Video',
        },
        {
          name: 'title',
          type: 'text',
          required: true,
          defaultValue: 'Vaata, kuidas üks tahvel muutub lapse igapäevaseks abiliseks',
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          defaultValue:
            'Lühikeses videos näed, kuidas luua piltidega tahvel, lisada sinna sõnad ja kasutada seda lapsevaates. Sama keskkonna kaudu saab avada ka mängulisi harjutusi.',
        },
        mediaField('poster', 'Video poster või placeholder'),
        mediaField('videoFile', 'Video fail'),
        {
          name: 'embedUrl',
          label: 'Video embed URL',
          type: 'text',
          admin: {
            description: 'Valikuline. Kasuta siis, kui video on YouTube/Vimeo vms keskkonnas.',
          },
        },
        {
          name: 'placeholderLabel',
          label: 'Placeholder tekst',
          type: 'text',
          defaultValue: 'Video lisandub peagi',
        },
      ],
    },
    {
      name: 'features',
      label: 'Võimalused',
      type: 'group',
      fields: [
        {
          name: 'enabled',
          label: 'Kuva sektsioon',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'eyebrow',
          type: 'text',
          defaultValue: 'Võimalused',
        },
        {
          name: 'title',
          type: 'text',
          required: true,
          defaultValue: 'Suhtlustahvlid ja harjutused samas kohas',
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          defaultValue:
            'Suhtleja ei ole ainult pildipank. See on lapsele lihtne koduvaade, kus vajalikud suhtlustahvlid ja mängulised tegevused on kohe kättesaadavad.',
        },
        {
          name: 'items',
          label: 'Võimaluste plokid',
          type: 'array',
          minRows: 2,
          maxRows: 4,
          defaultValue: [
            {
              title: 'Suhtlustahvlid',
              description:
                'Loo tahvleid söömiseks, mängimiseks, õues käimiseks, tunnete väljendamiseks või teraapiaks. Iga ruut võib sisaldada pilti, teksti ja kõnet.',
              imageLabel: 'Boards Feature Image',
            },
            {
              title: 'Ühenda punktid',
              description:
                'Lisa pilt, märgi punktid ja lase lapsel neid järjest ühendada. Harjutus toetab tähelepanu, loendamist, järjestust ja käe-silma koostööd.',
              imageLabel: 'Connect-Dots Feature Image',
            },
            {
              title: 'Turvaline lapsevaade',
              description:
                'Laps näeb ainult talle mõeldud tegevusi. Haldus, muutmine ja seadistused on vanemavaate taga.',
              imageLabel: 'Child-safe home view',
            },
            {
              title: 'Jagatav sisu',
              description:
                'Vanem või spetsialist saab hoida lapsele olulised tahvlid koduvaates ning kasutada ka jagatud materjale, kui need on kättesaadavad.',
              imageLabel: 'Shared content',
            },
          ],
          fields: [
            ...textPairFields,
            mediaField('image', 'Pilt või mockup'),
            {
              name: 'imageAspectRatio',
              dbName: 'img_ratio',
              label: 'Pildi kuvasuhe',
              type: 'select',
              defaultValue: '16/9',
              options: [
                { label: '16:9 lai', value: '16/9' },
                { label: '4:3 klassikaline', value: '4/3' },
                { label: '3:2 lai foto', value: '3/2' },
                { label: '1:1 ruut', value: '1/1' },
                { label: '2:3 püstine', value: '2/3' },
                { label: '9:16 telefoni portree', value: '9/16' },
              ],
            },
            {
              name: 'imageLabel',
              label: 'Pildi placeholder',
              type: 'text',
            },
          ],
        },
      ],
    },
    {
      name: 'audience',
      label: 'Kellele',
      type: 'group',
      admin: { description: fallbackGroupDescription },
      fields: [
        enabledField,
        fallbackText('eyebrow', d.audience.eyebrow),
        {
          name: 'title',
          type: 'text',
          required: true,
          defaultValue: 'Loodud igapäevaseks kasutamiseks kodus, lasteaias, koolis ja teraapias',
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          defaultValue:
            'Suhtleja sobib lapsele, kes vajab suhtlemisel visuaalset tuge, lihtsat valikute tegemist või korduvat harjutamist. Keskkond aitab täiskasvanul valmistada ette selgeid tegevusi ja hoida lapse ekraani rahulikuna.',
        },
        {
          name: 'cards',
          label: 'Kaardid',
          type: 'array',
          maxRows: 3,
          admin: { description: fallbackListDescription },
          fields: [
            ...textPairFields,
            {
              name: 'link',
              type: 'group',
              fields: [
                { name: 'label', type: 'text' },
                { name: 'href', type: 'text' },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'listen',
      label: 'Kuula ise',
      type: 'group',
      admin: { description: fallbackGroupDescription },
      fields: [
        enabledField,
        fallbackText('eyebrow', d.listen.eyebrow),
        fallbackText('title', d.listen.title),
        fallbackText('description', d.listen.description, { type: 'textarea' }),
        {
          name: 'tiles',
          label: 'Pildid',
          type: 'array',
          maxRows: 8,
          admin: {
            description: `Iga pilt ütleb oma sildi eestikeelse kõnesünteesiga. ${fallbackListDescription}`,
          },
          fields: [
            { name: 'label', label: 'Sõna', type: 'text', required: true },
            mediaField('image', 'Pilt'),
          ],
        },
      ],
    },
    {
      name: 'steps',
      label: 'Kuidas alustada',
      type: 'group',
      admin: { description: fallbackGroupDescription },
      fields: [
        enabledField,
        fallbackText('eyebrow', d.steps.eyebrow),
        fallbackText('title', d.steps.title),
        {
          name: 'items',
          label: 'Sammud',
          type: 'array',
          maxRows: 4,
          admin: { description: fallbackListDescription },
          fields: textPairFields,
        },
      ],
    },
    {
      name: 'about',
      label: 'Miks Suhtleja',
      type: 'group',
      admin: { description: fallbackGroupDescription },
      fields: [
        enabledField,
        fallbackText('eyebrow', d.about.eyebrow),
        fallbackText('title', d.about.title),
        fallbackText('description', d.about.description, { type: 'textarea' }),
        {
          name: 'points',
          label: 'Põhjused',
          type: 'array',
          maxRows: 4,
          admin: { description: fallbackListDescription },
          fields: textPairFields,
        },
        fallbackLink('link', 'Link', d.about.link),
        {
          name: 'testimonials',
          label: 'Tagasiside',
          type: 'array',
          maxRows: 6,
          admin: { description: 'Kuvatakse ainult siis, kui lisad vähemalt ühe tsitaadi.' },
          fields: [
            { name: 'quote', label: 'Tsitaat', type: 'textarea', required: true },
            { name: 'name', label: 'Nimi', type: 'text', required: true },
            { name: 'role', label: 'Roll', type: 'text', admin: { placeholder: 'Lapsevanem' } },
          ],
        },
      ],
    },
    {
      name: 'pricing',
      label: 'Hind',
      type: 'group',
      admin: { description: fallbackGroupDescription },
      fields: [
        enabledField,
        fallbackText('eyebrow', d.pricing.eyebrow),
        fallbackText('title', d.pricing.title),
        fallbackText('description', d.pricing.description, { type: 'textarea' }),
        fallbackText('planName', d.pricing.planName, { label: 'Paketi nimi' }),
        fallbackText('price', d.pricing.price, { label: 'Hind' }),
        fallbackText('period', d.pricing.period, { label: 'Periood' }),
        {
          name: 'includes',
          label: 'Hinna sees',
          type: 'array',
          maxRows: 8,
          admin: { description: fallbackListDescription },
          fields: [{ name: 'text', type: 'text', required: true }],
        },
        fallbackLink('cta', 'Nupp', d.pricing.cta),
        fallbackText('note', d.pricing.note, { label: 'Märkus nupu all', type: 'textarea' }),
        {
          name: 'institutions',
          label: 'Asutustele',
          type: 'group',
          fields: [
            fallbackText('text', d.pricing.institutions.text),
            fallbackText('label', d.pricing.institutions.label),
            fallbackText('href', d.pricing.institutions.href),
          ],
        },
      ],
    },
    {
      name: 'faq',
      label: 'KKK',
      type: 'group',
      admin: { description: fallbackGroupDescription },
      fields: [
        enabledField,
        fallbackText('eyebrow', d.faq.eyebrow),
        fallbackText('title', d.faq.title),
        {
          name: 'items',
          label: 'Küsimused',
          type: 'array',
          maxRows: 12,
          admin: { description: fallbackListDescription },
          fields: [
            { name: 'question', label: 'Küsimus', type: 'text', required: true },
            { name: 'answer', label: 'Vastus', type: 'textarea', required: true },
          ],
        },
      ],
    },
    {
      name: 'closing',
      label: 'Lõpp-üleskutse',
      type: 'group',
      admin: { description: fallbackGroupDescription },
      fields: [
        enabledField,
        fallbackText('title', d.closing.title),
        fallbackText('description', d.closing.description, { type: 'textarea' }),
        fallbackLink('cta', 'Nupp', d.closing.cta),
        fallbackText('note', d.closing.note, { label: 'Märkus nupu all' }),
      ],
    },
  ],
}
