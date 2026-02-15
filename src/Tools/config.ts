import type { GlobalConfig } from 'payload'
import { isAdmin } from '@/access/IsAdmin'

const defaultTools = [
  { slug: '/feelings', enabled: true },
  { slug: '/quick-chat', enabled: true },
  { slug: '/connect-dots', enabled: true },
]

export const ToolsGlobal: GlobalConfig = {
  slug: 'tools',
  label: 'Tools / Suhtlusvahendid',
  access: {
    read: () => true,
    update: isAdmin,
  },
  admin: {
    description: 'Vali, millised tööriistad on /tools vaates nähtavad.',
  },
  fields: [
    {
      name: 'items',
      type: 'array',
      label: 'Tööriistad',
      defaultValue: defaultTools,
      labels: {
        singular: 'Tööriist',
        plural: 'Tööriistad',
      },
      fields: [
        {
          name: 'slug',
          type: 'select',
          required: true,
          options: [
            { label: 'Emotsiooniratas', value: '/feelings' },
            { label: 'Kiirsuhtlus', value: '/quick-chat' },
            { label: 'Ühenda punktid', value: '/connect-dots' },
          ],
        },
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Nähtav /tools vaates',
          defaultValue: true,
        },
      ],
    },
  ],
}
