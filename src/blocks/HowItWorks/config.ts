import type { Block } from 'payload'

import { MEMBERSHIP_TRIAL_DAYS } from '@/utilities/membershipCheckout'

export const HowItWorks: Block = {
  slug: 'howItWorks',
  interfaceName: 'HowItWorksBlock',
  labels: {
    singular: 'Sammud',
    plural: 'Sammud',
  },
  fields: [
    {
      name: 'eyebrow',
      label: 'Väike silt pealkirja kohal',
      type: 'text',
    },
    {
      name: 'title',
      label: 'Pealkiri',
      type: 'text',
      required: true,
      defaultValue: 'Kuidas see töötab',
      admin: {
        description: 'Kui pealkiri kordab lehe nime ja plokk on lehel esimene, saab sellest lehe peapealkiri (h1).',
      },
    },
    {
      name: 'intro',
      label: 'Sissejuhatus',
      type: 'textarea',
      defaultValue:
        'Suhtleja on pilditahvel, mis räägib. Laps puudutab pilti, kuuleb sõna eesti keeles ja saab nii öelda, mida ta tahab, tunneb või vajab. Nii jõuad esimese tahvlini.',
    },
    {
      name: 'steps',
      label: 'Sammud',
      type: 'array',
      minRows: 1,
      maxRows: 10,
      admin: {
        description: 'Lisa igale sammule päris ekraanipilt või lühike video rakendusest.',
      },
      defaultValue: [
        {
          title: 'Loo konto',
          description: `Registreeru e-posti aadressiga. Esimesed ${MEMBERSHIP_TRIAL_DAYS} päeva on tasuta ja kaarti pole vaja.`,
        },
        {
          title: 'Ava lapse koduvaade',
          description: 'Koduvaade on lapse oma ekraan. Seal on ainult tema tahvlid ja mängud.',
        },
        {
          title: 'Loo tahvel',
          description:
            'Vali valmis tahvel, lase Suhtlejal tahvel teema järgi automaatselt luua või lisa pildipangast ja oma fotodest pildid ja sõnad.',
        },
        {
          title: 'Laps paneb lause kokku',
          description:
            'Laps puudutab pilte, kuuleb iga sõna eesti keeles ja saab sõnadest lause kokku panna.',
        },
        {
          title: 'Seaded jäävad lukku',
          description:
            'Muutmiseks ja seadetesse minekuks on vaja vanema neljakohalist PIN-koodi, nii et laps ei muuda tahvleid kogemata.',
        },
        {
          title: 'Harjuta punktimänguga',
          description:
            'Ühenda punktid mängus ühendab laps punkte järjest. See harjutab tähelepanu, loendamist, järjestust ja käe-silma koostööd.',
        },
      ],
      fields: [
        { name: 'title', label: 'Pealkiri', type: 'text', required: true },
        { name: 'description', label: 'Kirjeldus', type: 'textarea', required: true },
        {
          name: 'media',
          label: 'Ekraanipilt või video',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'mediaAspectRatio',
          dbName: 'media_ratio',
          label: 'Kuvasuhe',
          type: 'select',
          defaultValue: '4/3',
          options: [
            { label: '16:9 lai', value: '16/9' },
            { label: '4:3 tahvelarvuti', value: '4/3' },
            { label: '1:1 ruut', value: '1/1' },
            { label: '9:16 telefoni portree', value: '9/16' },
          ],
        },
      ],
    },
    {
      name: 'cta',
      label: 'Lõpunupp',
      type: 'group',
      admin: {
        description: 'Jäta nupu tekst tühjaks, kui lõpunuppu pole vaja.',
      },
      fields: [
        { name: 'title', label: 'Pealkiri', type: 'text', defaultValue: 'Proovi Suhtlejat oma lapsega' },
        { name: 'label', label: 'Nupu tekst', type: 'text', defaultValue: 'Proovi tasuta' },
        { name: 'href', label: 'Nupu link', type: 'text', defaultValue: '/register' },
        {
          name: 'note',
          label: 'Märkus nupu all',
          type: 'text',
          defaultValue: `Esimesed ${MEMBERSHIP_TRIAL_DAYS} päeva on tasuta. Kaarti pole vaja.`,
        },
      ],
    },
  ],
}
