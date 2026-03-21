import type { AccessArgs, CollectionConfig, Where } from 'payload'
import type { User } from '@/payload-types'
import { hasActiveMembership } from '@/utilities/membershipStatus'

const canManageBoard = ({ req }: AccessArgs<User>): boolean | Where => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  if (!hasActiveMembership(req.user)) return false

  return {
    owner: {
      equals: req.user.id,
    },
  }
}

const canReadBoard = ({ req }: AccessArgs<User>): boolean | Where => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  if (!hasActiveMembership(req.user)) return false

  return {
    or: [
      {
        owner: {
          equals: req.user.id,
        },
      },
      {
        visibleToAllUsers: {
          equals: true,
        },
      },
    ],
  }
}

export const Boards: CollectionConfig = {
  slug: 'boards',
  admin: {
    defaultColumns: ['name', 'owner', 'pinned', 'visibleToAllUsers', 'updatedAt'],
    useAsTitle: 'name',
  },
  access: {
    read: canReadBoard,
    create: ({ req }) => {
      const user = req.user as User | null | undefined
      if (!user) return false
      if (user.role === 'admin') return true
      return hasActiveMembership(user)
    },
    update: canManageBoard,
    delete: canManageBoard,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: { readOnly: true },
      defaultValue: ({ user }) => user?.id,
    },
    {
      name: 'pinned',
      type: 'checkbox',
      label: 'Näita koduvaates',
      defaultValue: true,
    },
    {
      name: 'visibleToAllUsers',
      type: 'checkbox',
      label: 'Nähtav kõigile kasutajatele',
      defaultValue: false,
      admin: {
        description: 'Kui väljas, näevad tahvlit ainult omanik ja administraatorid.',
        position: 'sidebar',
      },
      access: {
        update: ({ req }) => req.user?.role === 'admin',
      },
    },
    {
      name: 'order',
      type: 'number',
      label: 'Järjekord',
      admin: {
        position: 'sidebar',
        description: 'Mida väiksem number, seda eespool koduvaates.',
      },
    },
    { name: 'thumbnail', type: 'upload', relationTo: 'media' },
    {
      name: 'actionBar',
      type: 'group',
      admin: { description: 'Ülemine “valitud” riba / fraasid' },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: true,
          label: 'Display action bar',
        },
      ],
    },
    {
      name: 'extra',
      type: 'group',
      admin: { description: 'Extra valikud / seaded' },
      fields: [
        {
          name: 'ai',
          type: 'checkbox',
          defaultValue: false,
          label: 'Use AI to generate text',
        },
      ],
    },
    {
      name: 'grid',
      type: 'group',
      fields: [
        { name: 'cols', type: 'number', defaultValue: 12, min: 1 },
        { name: 'rows', type: 'number', defaultValue: 8, min: 1 },
        {
          name: 'cells',
          type: 'array',
          fields: [
            { name: 'id', type: 'text', required: true },
            { name: 'x', type: 'number', required: true },
            { name: 'y', type: 'number', required: true },
            { name: 'w', type: 'number', required: true },
            { name: 'h', type: 'number', required: true },
            { name: 'title', type: 'text' },
            { name: 'image', type: 'upload', relationTo: 'media' },
            { name: 'externalImageURL', type: 'text' },
            { name: 'audio', type: 'upload', relationTo: 'media' },
            { name: 'locked', type: 'checkbox', defaultValue: false },
          ],
        },
      ],
    },
    {
      name: 'compounds',
      type: 'array',
      label: 'Sõnaühendid',
      admin: {
        description:
          'Spetsiifilised cellide kombinatsioonid (nt "kaks" + "kass" → "kaks kassi").',
      },
      fields: [
        {
          name: 'id',
          label: 'ID',
          type: 'text',
          required: true,
          admin: {
            description: 'Unikaalne id (nt kaks-kass-plural).',
          },
        },
        {
          name: 'cells',
          label: 'Cellide jada',
          type: 'array',
          minRows: 2,
          admin: {
            description: 'Kombinatsioon milliste cellide jadas see fraas käivitub.',
          },
          fields: [
            {
              name: 'cellId',
              label: 'Cell ID',
              type: 'text',
              required: true,
            },
          ],
        },
        {
          name: 'parts',
          label: 'Sõnad / vormid',
          type: 'array',
          minRows: 1,
          admin: {
            description:
              'Sama arv ridu kui cellidel. Iga positsioonile saad määrata kuvatava ja TTS-kuju.',
          },
          fields: [
            {
              name: 'surface',
              label: 'Tekst ekraanil',
              type: 'text',
              required: true,
            },
            {
              name: 'tts',
              label: 'TTS tekst (valikuline)',
              type: 'text',
              required: false,
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data

        if (typeof data.order === 'number') return data

        const ownerId = data.owner || req.user?.id
        if (!ownerId) return data

        const result = await req.payload.find({
          collection: 'boards',
          where: {
            owner: {
              equals: ownerId,
            },
          },
          sort: '-order',
          limit: 1,
        })

        const maxOrder = result.docs[0]?.order ?? 0
        data.order = maxOrder + 1

        return data
      },
    ],
  },
}
