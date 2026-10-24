import { describe, expect, it } from 'vitest'
import { formatLogEntry } from '@/utilities/cloudflareLogger'

describe('cloudflare logger', () => {
  it('keeps the error message, stack and cause', () => {
    const cause = new Error('D1_ERROR: no such column: foo')
    const err = new Error('Failed query: insert into "users"', { cause })

    const entry = JSON.parse(formatLogEntry('error', { err }))

    expect(entry.level).toBe('error')
    expect(entry.err.message).toBe('Failed query: insert into "users"')
    expect(entry.err.stack).toContain('Failed query')
    expect(entry.err.cause.message).toBe('D1_ERROR: no such column: foo')
  })

  it('redacts query params', () => {
    const err = new Error('Failed query: insert into "users"\nparams: user@example.com,secret-hash')

    const output = formatLogEntry('error', { err })

    expect(output).not.toContain('user@example.com')
    expect(output).not.toContain('secret-hash')
    expect(JSON.parse(output).err.message).toBe('Failed query: insert into "users"\nparams: [redacted]')
  })

  it('logs plain messages', () => {
    expect(JSON.parse(formatLogEntry('info', 'Done.'))).toEqual({ level: 'info', msg: 'Done.' })
  })
})
