import type { CollectionConfig } from 'payload'
import { slugField } from 'payload'
import { anyone } from '@/access/anyone'
import { isAdmin } from '@/access/IsAdmin'
import { normalizeDots, validateConnectDotsDots } from '@/utilities/connectDots'

export const ConnectDotsPuzzles: CollectionConfig = {
  slug: 'connect-dots-puzzles',
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: anyone,
    update: isAdmin,
  },
  admin: {
    defaultColumns: ['title', 'enabled', 'updatedAt'],
    useAsTitle: 'title',
  },
  defaultPopulate: {
    title: true,
    slug: true,
    enabled: true,
    order: true,
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
      label: 'Visible on /connect-dots',
      admin: {
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
      ({ data }) => {
        if (data && 'dots' in data) {
          data.dots = normalizeDots(data.dots)
        }

        return data
      },
    ],
  },
}
