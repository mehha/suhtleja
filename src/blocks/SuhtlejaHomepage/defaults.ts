import { MEMBERSHIP_TRIAL_DAYS } from '@/utilities/membershipCheckout'

// Fallback copy for the homepage block. Sections added after the homepage was first
// saved have no stored content, so empty fields render these values. The admin shows
// them as placeholders, so editors can see what an empty field displays.

const trialNote = `Esimesed ${MEMBERSHIP_TRIAL_DAYS} päeva on tasuta. Kaarti pole vaja.`

export const homepageDefaults = {
  hero: {
    note: trialNote,
    badges: [
      'Puuduta pilti ja kuula sõna',
      'Lapsevaade on PIN-koodiga lukus',
      'Oma pildid või pildipank',
    ],
  },
  audience: {
    eyebrow: 'Kellele',
    cards: [
      {
        title: 'Lapsevanemale',
        description:
          'Tee lapsele tahvlid tema enda päeva jaoks: söök, riietumine, mänguasjad ja tunded. Laps kasutab neid oma koduvaates.',
        link: { label: 'Alusta kodus', href: '/register' },
      },
      {
        title: 'Lasteaiale ja koolile',
        description:
          'Valmista rühmale või klassile ette pildid ja tegevused, mida laps saab päeva jooksul korduvalt kasutada.',
        link: { label: 'Võta ühendust', href: '/kontakt' },
      },
      {
        title: 'Logopeedile ja terapeudile',
        description:
          'Loo lapsele tähenduslikke harjutusi ja suhtlustahvleid, mida saab tundides ikka ja jälle kasutada.',
        link: { label: 'Vaata, kuidas see töötab', href: '/kuidas-see-tootab' },
      },
    ],
  },
  listen: {
    eyebrow: 'Kuula ise',
    title: 'Puuduta pilti ja kuula',
    description:
      'Nii kõlab Suhtleja tahvel. Iga pilt ütleb oma sõna eesti keeles ja sõnadest saab lause kokku panna.',
    tiles: ['juua', 'süüa', 'mängida', 'veel', 'aitäh', 'valmis'],
  },
  steps: {
    eyebrow: 'Kuidas alustada',
    title: 'Nii alustad',
    items: [
      {
        title: 'Loo konto',
        description: `Registreeru ja ava lapsele oma koduvaade. Esimesed ${MEMBERSHIP_TRIAL_DAYS} päeva on tasuta.`,
      },
      {
        title: 'Lisa tahvlid',
        description:
          'Vali valmis tahvel, lase Suhtlejal tahvel automaatselt luua või lisa oma pildid ja sõnad.',
      },
      {
        title: 'Anna seade lapsele',
        description:
          'Lapsevaates näeb laps ainult talle valitud tahvleid ja mänge. Seadetesse pääseb vanema PIN-koodiga.',
      },
    ],
  },
  about: {
    eyebrow: 'Miks Suhtleja',
    title: 'Eestikeelne abivahend igapäevaseks suhtlemiseks',
    description:
      'Meie eesmärk on teha suhtlemine kõigile kättesaadavaks – lihtsasti, eestikeelselt ja igapäevaselt.',
    points: [
      {
        title: 'Kõik on eesti keeles',
        description:
          'Tahvlid, nupud ja kõne on eesti keeles. Laps kuuleb sõnu eestikeelse kõnesünteesiga.',
      },
      {
        title: 'Laps on turvalises vaates',
        description:
          'Lapsevaates on ainult tema tahvlid ja mängud. Muutmiseks on vaja vanema neljakohalist PIN-koodi.',
      },
      {
        title: 'Paigaldamist pole vaja',
        description: 'Suhtleja töötab veebibrauseris: iPadis, tahvelarvutis ja arvutis.',
      },
    ],
    link: { label: 'Loe meist lähemalt', href: '/meist' },
  },
  pricing: {
    eyebrow: 'Hind',
    title: 'Üks pakett, kõik võimalused',
    description: `Proovi ${MEMBERSHIP_TRIAL_DAYS} päeva tasuta. Kui Suhtleja sobib, jätka kuutasuga.`,
    planName: 'Suhtleja liikmelisus',
    price: '14 €',
    period: 'kuus',
    includes: [
      'Suhtlustahvlid ja tahvlite automaatne loomine',
      'Pildipangad ja oma pildid',
      'Sõnaühendid lausete loomiseks',
      'Eestikeelne kõnesüntees',
      'Ühenda punktid mängud',
      'Lapsevaade vanema PIN-koodiga',
    ],
    cta: { label: 'Proovi tasuta', href: '/register' },
    note: `${MEMBERSHIP_TRIAL_DAYS} päeva tasuta, kaarti pole vaja. Liikmelisuse saad igal ajal profiililehel lõpetada.`,
    institutions: {
      text: 'Lasteaed, kool või rehabilitatsiooniasutus?',
      label: 'Võta ühendust',
      href: '/kontakt',
    },
  },
  faq: {
    eyebrow: 'KKK',
    title: 'Korduma kippuvad küsimused',
    items: [
      {
        question: 'Kas Suhtleja asendab logopeedi?',
        answer:
          'Ei. Suhtleja on abivahend igapäevaseks suhtlemiseks ja harjutamiseks. Lapse arengu hindamine ja teraapia jäävad spetsialisti teha. Logopeed või terapeut saab Suhtlejas lapsele tahvleid ja harjutusi ette valmistada.',
      },
      {
        question: 'Mis seadet on vaja?',
        answer:
          'Sobib iga seade, millel on kaasaegne veebibrauser: iPad, tahvelarvuti või arvuti. Rakendust pole vaja paigaldada.',
      },
      {
        question: 'Mis saab pärast tasuta prooviaega?',
        answer: `Prooviaeg kestab ${MEMBERSHIP_TRIAL_DAYS} päeva ja selle alustamiseks pole kaarti vaja. Kui soovid jätkata, lisa profiililehel makseviis. Kui makseviisi ei lisa, lõpeb liikmelisus prooviaja lõppedes iseenesest.`,
      },
      {
        question: 'Kas saan kasutada oma pilte?',
        answer:
          'Jah. Võid kasutada pildipanga pilte või laadida üles oma fotosid, näiteks lapse mänguasjadest, toidust või pereliikmetest.',
      },
      {
        question: 'Kas laps saab kogemata seadeid muuta?',
        answer:
          'Ei. Lapsevaates näeb laps ainult talle valitud tahvleid ja mänge. Muutmiseks ja seadetesse minekuks on vaja vanema neljakohalist PIN-koodi.',
      },
      {
        question: 'Kas Suhtlejat saab kasutada lasteaias või koolis?',
        answer:
          'Jah. Õpetaja või tugispetsialist saab luua tahvleid ja harjutusi, mida laps kasutab rühmas või tunnis. Asutuse kasutuse kohta küsi lisa kontaktilehelt.',
      },
    ],
  },
  closing: {
    title: 'Proovi Suhtlejat oma lapsega',
    description: 'Loo lapsele esimene koduvaade ja vali tahvlid, mis talle sobivad.',
    cta: { label: 'Loo lapsele esimene koduvaade', href: '/register' },
    note: trialNote,
  },
}

export function textOr(value: string | null | undefined, fallback: string): string {
  return value?.trim() ? value : fallback
}

export function rowsOr<T>(rows: T[] | null | undefined, fallback: T[]): T[] {
  return rows?.length ? rows : fallback
}

type ListenSection = {
  enabled?: boolean | null
  tiles?: { label?: string | null }[] | null
} | null

// Labels the "Kuula ise" tiles speak. Shared by the block component and the public
// speech route, so the route only speaks what the published homepage shows.
export function getListenLabels(listen: ListenSection | undefined): string[] {
  if (listen?.enabled === false) return []

  const stored = (listen?.tiles ?? [])
    .map((tile) => tile.label?.trim() ?? '')
    .filter(Boolean)

  return stored.length ? stored : homepageDefaults.listen.tiles
}
