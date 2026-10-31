import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/access/IsAdmin'

/**
 * One row per "Loo pilt" request in the board card editor. It counts each member's AI pictogram
 * generations against the monthly limit and lets admins see what was generated. Only server code
 * (`/next/symbol-generate`, Local API) writes it.
 */
export const SymbolGenerations: CollectionConfig = {
  slug: 'symbol-generations',
  access: {
    create: () => false,
    delete: isAdmin,
    read: isAdmin,
    update: () => false,
  },
  admin: {
    defaultColumns: ['label', 'user', 'createdAt'],
    useAsTitle: 'label',
  },
  labels: {
    plural: 'AI-pildid',
    singular: 'AI-pilt',
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      // Not required: deleting a user sets this to null instead of failing on the foreign key.
    },
    {
      name: 'label',
      type: 'text',
      required: true,
    },
    {
      name: 'prompt',
      type: 'textarea',
    },
    {
      name: 'images',
      type: 'number',
      admin: {
        description: 'Mitu pilti mudel tagastas.',
      },
    },
  ],
}
