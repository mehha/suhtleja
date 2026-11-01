import type { AccessArgs, CollectionConfig, Where } from 'payload'
import type { User } from '@/payload-types'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

// A member changes or deletes only their own media outside the shared library. A file in a folder
// (the picture bank, shared AI pictures) is on other members' boards and in their search, so only
// admins may replace or delete it, even when a member made it.
const canManageMedia = ({ req }: AccessArgs<User>): boolean | Where => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true

  return {
    and: [{ owner: { equals: req.user.id } }, { folder: { exists: false } }],
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
      ({ context, data, operation, originalDoc, req }) => {
        if (operation === 'create' && req.user) {
          if (req.user.role !== 'admin' || !data.owner) {
            data.owner = req.user.id
          }
        }

        // A folder makes a file part of the shared library, which every member sees in the picture
        // search and bulk add. Only admins and server code may put files there (`fileIntoLibrary` is
        // set by the AI picture hooks in SymbolGenerations, which run inside a member's request).
        if (
          req.user &&
          req.user.role !== 'admin' &&
          !context?.fileIntoLibrary &&
          'folder' in data
        ) {
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
