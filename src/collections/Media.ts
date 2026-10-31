import type { AccessArgs, CollectionConfig, Where } from 'payload'
import type { User } from '@/payload-types'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

const canManageMedia = ({ req }: AccessArgs<User>): boolean | Where => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true

  return {
    owner: {
      equals: req.user.id,
    },
  }
}

export const Media: CollectionConfig = {
  slug: 'media',
  folders: true,
  access: {
    create: authenticated,
    delete: canManageMedia,
    read: anyone,
    update: canManageMedia,
  },
  fields: [
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Kasutaja, kes laadis faili üles. Omanik või admin saab faili muuta ja kustutada.',
        position: 'sidebar',
      },
      access: {
        update: ({ req }) => req.user?.role === 'admin',
      },
      defaultValue: ({ user }) => user?.id,
      index: true,
    },
    {
      name: 'alt',
      type: 'text',
      //required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
  ],
  upload: {
    // Upload to the public/media directory in Next.js making them publicly accessible even outside of Payload
    // These are not supported on Workers yet due to lack of sharp
    crop: false,
    focalPoint: false,
  },
  hooks: {
    beforeChange: [
      ({ data, operation, originalDoc, req }) => {
        if (operation === 'create' && req.user) {
          if (req.user.role !== 'admin' || !data.owner) {
            data.owner = req.user.id
          }
        }

        // A folder makes a file part of the shared library, which every member sees in the picture
        // search and bulk add. Only admins (and server code without a user) may put files there.
        if (req.user && req.user.role !== 'admin' && 'folder' in data) {
          const original = originalDoc?.folder
          data.folder =
            operation === 'create'
              ? null
              : typeof original === 'object' && original
                ? original.id
                : (original ?? null)
        }

        return data
      },
    ],
  },
}
