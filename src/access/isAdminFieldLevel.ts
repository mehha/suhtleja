import type { FieldAccess } from 'payload'

export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => user?.role === 'admin'
