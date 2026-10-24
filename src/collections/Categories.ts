import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { isAdmin } from '@/access/IsAdmin'
import { slugField } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: anyone,
    update: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField({
      position: undefined,
    }),
  ],
}
