// payload/globals/Header.ts
import type { GlobalConfig } from 'payload'
import { link } from '@/fields/link'
import { revalidateHeader } from './hooks/revalidateHeader'
import { isAdmin } from '@/access/IsAdmin'

export const Header: GlobalConfig = {
  slug: 'header',
  access: { read: () => true, update: isAdmin },
  fields: [
    {
      name: 'navItems',
      label: 'Navigation',
      type: 'array',
      maxRows: 8,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Header/RowLabel#RowLabel',
        },
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: false,
          admin: { description: 'Optional override label for this item.' },
        },
        link({ appearances: false }),
        {
          name: 'children',
          label: 'Sub-items',
          type: 'array',
          maxRows: 12,
          admin: { initCollapsed: true },
          fields: [
            {
              name: 'label',
              type: 'text',
              required: false,
              admin: { description: 'Optional override label for this sub-item.' },
            },
            link({ appearances: false }),
          ],
        },
      ],
    },
  ],
  hooks: { afterChange: [revalidateHeader] },
}
