import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/access/IsAdmin'
import { isAdminFieldLevel } from '@/access/isAdminFieldLevel'
import { isAdminOrSelf } from '@/access/isAdminOrSelf'
import bcrypt from 'bcryptjs'

const DEFAULT_PARENT_PIN = process.env.DEFAULT_PARENT_PIN || '0000'

// Only admins may set these through the API. Server code uses the Local API, which skips
// access checks, so the Stripe webhook and profile actions can still write them.
const adminOnlyField = { create: isAdminFieldLevel, update: isAdminFieldLevel }

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: isAdmin,
    // Public sign-up stays open; adminOnlyField keeps new accounts as plain users.
    create: () => true,
    delete: isAdmin,
    read: isAdminOrSelf,
    update: isAdminOrSelf,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
    hidden: ({ user }) => user?.role !== 'admin',
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 // 1 day
  },
  hooks: {
    beforeChange: [
      async ({ data, operation }) => {
        if (operation === 'create' && !data.parentPinHash) {
          data.parentPinHash = await bcrypt.hash(DEFAULT_PARENT_PIN, 10)
          data.pinUpdatedAt = new Date().toISOString()
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      access: adminOnlyField,
      type: 'select',
      defaultValue: 'user',
      options: ['admin', 'user'],
      required: true,
    },
    {
      name: 'parentPinHash',
      access: adminOnlyField,
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Hashed PIN vanema vaate jaoks',
      },
    },
    {
      name: 'pinUpdatedAt',
      access: adminOnlyField,
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'stripeCustomerId',
      access: adminOnlyField,
      label: 'Stripe Customer ID',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'stripeSubscriptionId',
      access: adminOnlyField,
      label: 'Stripe Subscription ID',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'membershipStatus',
      access: adminOnlyField,
      label: 'Liikmelisuse staatus',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'Puudub', value: 'none' },
        { label: 'Trial', value: 'trialing' },
        { label: 'Aktiivne', value: 'active' },
        { label: 'Makseraskus', value: 'past_due' },
        { label: 'Lõpetatud', value: 'canceled' },
      ],
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'trialEndsAt',
      access: adminOnlyField,
      label: 'Trial lõpeb',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'currentPeriodEndsAt',
      access: adminOnlyField,
      label: 'Periood lõpeb',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'membershipCancelAtPeriodEnd',
      access: adminOnlyField,
      label: 'Lõpetamine perioodi lõpus',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'hiddenSharedBoardIds',
      type: 'json',
      defaultValue: [],
      admin: {
        hidden: true,
      },
    },
    {
      name: 'hiddenSharedPuzzleIds',
      type: 'json',
      defaultValue: [],
      admin: {
        hidden: true,
      },
    },
    {
      name: 'sharedBoardOrder',
      type: 'json',
      defaultValue: [],
      admin: {
        hidden: true,
      },
    },
    {
      name: 'sharedPuzzleOrder',
      type: 'json',
      defaultValue: [],
      admin: {
        hidden: true,
      },
    },
  ],
  timestamps: true,
}
