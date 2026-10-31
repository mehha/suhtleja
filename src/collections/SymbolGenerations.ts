import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  PayloadRequest,
} from 'payload'

import { isAdmin } from '@/access/IsAdmin'
import { getOrCreateAIPictureFolderId } from '@/utilities/findLibraryMedia'

const relationId = (value: unknown): number | null => {
  if (typeof value === 'object' && value) return (value as { id: number }).id
  return typeof value === 'number' ? value : null
}

// Shared AI pictures are media in the "AI-pildid" library folder. Sharing files the picture there;
// unsharing takes it out again, unless an admin has since moved it to another folder. The media itself
// stays, so the boards it is on keep their picture.
async function fileIntoLibrary(req: PayloadRequest, mediaId: number, shared: boolean) {
  const { payload } = req
  const media = await payload
    .findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true, req })
    .catch(() => null)
  if (!media) return

  const aiFolderId = await getOrCreateAIPictureFolderId(payload, req)
  const currentFolder = relationId(media.folder)
  const nextFolder =
    shared && currentFolder === null
      ? aiFolderId
      : !shared && currentFolder === aiFolderId
        ? null
        : undefined
  if (nextFolder === undefined) return

  await payload.update({
    collection: 'media',
    id: mediaId,
    data: { folder: nextFolder },
    overrideAccess: true,
    req,
    context: { fileIntoLibrary: true },
  })
}

const syncLibrary: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const mediaId = relationId(doc.media)
  if (!mediaId) return doc

  const sharedChanged = Boolean(doc.shared) !== Boolean(previousDoc?.shared)
  const mediaChanged = mediaId !== relationId(previousDoc?.media)
  if (sharedChanged || mediaChanged) {
    await fileIntoLibrary(req, mediaId, Boolean(doc.shared))
  }

  return doc
}

const unshareOnDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const mediaId = relationId(doc.media)
  if (mediaId && doc.shared) {
    await fileIntoLibrary(req, mediaId, false)
  }
  return doc
}

/**
 * One row per "Loo pildid" request in the board card editor. It counts each member's AI pictogram
 * generations against the monthly limit, remembers which generated images the member may save, and
 * holds the saved picture. A saved picture joins the shared library at once unless the card text
 * looked personal; admins untick "Ühises kogus" to take one out. Only server code
 * (`/next/symbol-generate`, Local API) creates rows.
 */
export const SymbolGenerations: CollectionConfig = {
  slug: 'symbol-generations',
  access: {
    create: () => false,
    delete: isAdmin,
    read: isAdmin,
    update: isAdmin,
  },
  admin: {
    defaultColumns: ['media', 'label', 'shared', 'personal', 'user', 'createdAt'],
    description:
      'AI-ga loodud kaardipildid. Salvestatud pilt läheb ühisesse kogusse (kaust „AI-pildid“), kus kõik liikmed seda otsingus ja hulgilisamises näevad. Eemalda linnuke „Ühises kogus“, et pilt kogust ära võtta; tegija tahvlitele jääb see alles.',
    listSearchableFields: ['label'],
    useAsTitle: 'label',
  },
  labels: {
    plural: 'AI-pildid',
    singular: 'AI-pilt',
  },
  hooks: {
    afterChange: [syncLibrary],
    afterDelete: [unshareOnDelete],
  },
  fields: [
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      label: 'Salvestatud pilt',
      admin: { readOnly: true },
    },
    {
      name: 'shared',
      type: 'checkbox',
      label: 'Ühises kogus',
      defaultValue: false,
      admin: {
        description: 'Kõik liikmed näevad pilti otsingus ja hulgilisamises.',
      },
    },
    {
      name: 'personal',
      type: 'checkbox',
      label: 'Isiklik',
      defaultValue: false,
      admin: {
        description: 'Kaardi tekstis oli nimi või muu isiklik, seega pilti ei jagatud.',
        readOnly: true,
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      // Not required: deleting a user sets this to null instead of failing on the foreign key.
      admin: { readOnly: true },
    },
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'prompt',
      type: 'textarea',
      admin: { readOnly: true },
    },
    {
      name: 'images',
      type: 'number',
      admin: {
        description: 'Mitu pilti mudel tagastas.',
        readOnly: true,
      },
    },
    {
      // SHA-256 of each generated image: /next/symbol-generate/save stores only one of these, so the
      // shared library can't be fed arbitrary uploads.
      name: 'imageHashes',
      type: 'json',
      admin: { hidden: true },
    },
  ],
}
