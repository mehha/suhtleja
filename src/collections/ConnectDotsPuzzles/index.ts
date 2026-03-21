import type { AccessArgs, CollectionConfig, Where } from 'payload'
import { slugField } from 'payload'
import { authenticated } from '@/access/authenticated'
import type { User } from '@/payload-types'
import { normalizeDots, validateConnectDotsDots } from '@/utilities/connectDots'

const isAdminOrPuzzleOwner = ({ req }: AccessArgs<User>): boolean | Where => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true

  return {
    owner: {
      equals: req.user.id,
    },
  }
}

const canReadPuzzle = ({ req }: AccessArgs<User>): boolean | Where => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true

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

export const ConnectDotsPuzzles: CollectionConfig = {
  slug: 'connect-dots-puzzles',
  access: {
    create: authenticated,
    delete: isAdminOrPuzzleOwner,
    read: canReadPuzzle,
    update: isAdminOrPuzzleOwner,
  },
  admin: {
    defaultColumns: ['title', 'owner', 'enabled', 'visibleToAllUsers', 'updatedAt'],
    useAsTitle: 'title',
  },
  defaultPopulate: {
    title: true,
    slug: true,
    enabled: true,
    pinned: true,
    visibleToAllUsers: true,
    order: true,
    owner: true,
    description: true,
    externalImageURL: true,
    image: true,
    backgroundMusic: true,
    dots: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'Visible in /connect-dots',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'pinned',
      type: 'checkbox',
      defaultValue: false,
      label: 'Visible in /kodu',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'visibleToAllUsers',
      type: 'checkbox',
      defaultValue: false,
      label: 'Visible to all users',
      admin: {
        description: 'If disabled, only the owner and admins can see this puzzle.',
        position: 'sidebar',
      },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      label: 'Sort order',
      admin: {
        description: 'Lower numbers appear first in the puzzle picker.',
        position: 'sidebar',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Optional short helper text shown under the puzzle selector.',
      },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      defaultValue: ({ user }) => user?.id,
    },
    {
      name: 'backgroundMusic',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Optional looping music for the frontend player. Starts after the child first taps the game.',
        position: 'sidebar',
      },
    },
    {
      name: 'externalImageURL',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'dots',
      type: 'json',
      required: true,
      validate: validateConnectDotsDots,
      admin: {
        hidden: true,
      },
    },
    {
      name: 'editor',
      type: 'ui',
      label: 'Puzzle editor',
      admin: {
        components: {
          Field: '@/components/ConnectDots/ConnectDotsEditorField#ConnectDotsEditorField',
        },
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        condition: (_, siblingData) => !siblingData?.externalImageURL,
      },
    },
    slugField({
      position: 'sidebar',
    }),
  ],
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create' && !data.owner && req.user?.id) {
          data.owner = req.user.id
        }

        if (data && 'dots' in data) {
          data.dots = normalizeDots(data.dots)
        }

        return data
      },
    ],
  },
}
