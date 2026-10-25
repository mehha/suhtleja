import type { Block } from 'payload'

export const Contact: Block = {
  slug: 'contact',
  interfaceName: 'ContactBlock',
  labels: {
    singular: 'Kontakt',
    plural: 'Kontaktid',
  },
  fields: [
    {
      name: 'intro',
      label: 'Sissejuhatus',
      type: 'textarea',
      defaultValue:
        'Kirjuta või helista, kui sul on küsimusi, vajad abi seadistamisel või soovid Suhtlejat kasutada lasteaias, koolis või teraapias.',
    },
    {
      name: 'email',
      label: 'E-post',
      type: 'email',
      required: true,
      defaultValue: 'info@mehh.ee',
    },
    {
      name: 'phone',
      label: 'Telefon',
      type: 'text',
      defaultValue: '+372 565 777 69',
    },
    {
      name: 'responseNote',
      label: 'Vastamise aeg',
      type: 'text',
      admin: {
        placeholder: 'nt Vastame tööpäevadel ühe päeva jooksul',
        description: 'Kuvatakse e-posti all. Jäta tühjaks, kui te ei taha vastamise aega lubada.',
      },
    },
    {
      name: 'topics',
      label: 'Teemad',
      type: 'array',
      maxRows: 4,
      admin: {
        description: 'Iga teema nupp avab kirja, mille teema on juba täidetud.',
      },
      defaultValue: [
        {
          title: 'Lapsevanemale',
          description:
            'Küsi abi konto, tahvlite või prooviaja kohta. Kirjuta, mis seadet kasutad, siis saame kiiremini aidata.',
          subject: 'Suhtleja: küsimus',
          buttonLabel: 'Kirjuta meile',
        },
        {
          title: 'Lasteaiale, koolile ja teraapiasse',
          description:
            'Kirjuta, kus ja mitme lapsega soovid Suhtlejat kasutada. Räägime, kuidas see teie rühmas, klassis või tundides sobiks.',
          subject: 'Suhtleja asutusele',
          buttonLabel: 'Kirjuta asutuse kohta',
        },
        {
          title: 'Tagasiside',
          description:
            'Kas midagi on keeruline või puudu? Iga mõte aitab Suhtlejat igapäevases kasutuses selgemaks ja kasulikumaks teha.',
          subject: 'Suhtleja: tagasiside',
          buttonLabel: 'Saada tagasiside',
        },
      ],
      fields: [
        { name: 'title', label: 'Pealkiri', type: 'text', required: true },
        { name: 'description', label: 'Kirjeldus', type: 'textarea', required: true },
        { name: 'subject', label: 'Kirja teema', type: 'text' },
        { name: 'buttonLabel', label: 'Nupu tekst', type: 'text', defaultValue: 'Kirjuta meile' },
      ],
    },
    {
      name: 'company',
      label: 'Ettevõte',
      type: 'group',
      fields: [
        { name: 'name', label: 'Nimi', type: 'text', defaultValue: 'Mehh Meedia OÜ' },
        { name: 'regCode', label: 'Registrikood', type: 'text', defaultValue: '16677696' },
        {
          name: 'address',
          label: 'Aadress',
          type: 'text',
          defaultValue: 'Idapõllu tee 5-30, 74001 Haabneeme alevik, Viimsi vald, Harju maakond',
        },
      ],
    },
  ],
}
