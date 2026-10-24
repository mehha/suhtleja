import type { Config } from 'payload'

// Payload's default pino logger writes to stdout, which Cloudflare Workers drops.
// In production we log JSON through console instead, so errors show up in
// `wrangler tail` and Workers logs. Adapted from Payload's with-cloudflare-d1 template.

type LogFn = (...args: unknown[]) => void

// Drizzle query errors end with "params: ...", which can hold emails and password hashes.
const redactParams = (text: string): string => text.replace(/\nparams: [\s\S]*/, '\nparams: [redacted]')

export const serializeError = (err: unknown, depth = 0): unknown => {
  if (!(err instanceof Error)) return err

  return {
    name: err.name,
    message: redactParams(err.message),
    stack: err.stack ? redactParams(err.stack) : undefined,
    ...(err.cause !== undefined && depth < 3 ? { cause: serializeError(err.cause, depth + 1) } : {}),
  }
}

export const formatLogEntry = (level: string, objOrMsg: unknown, msg?: string): string => {
  if (typeof objOrMsg === 'string') {
    return JSON.stringify({ level, msg: objOrMsg })
  }

  if (objOrMsg instanceof Error) {
    return JSON.stringify({ level, err: serializeError(objOrMsg), msg: msg ?? objOrMsg.message })
  }

  const { err, ...rest } = (objOrMsg ?? {}) as { err?: unknown; msg?: string }

  return JSON.stringify({
    level,
    ...rest,
    ...(err !== undefined ? { err: serializeError(err) } : {}),
    msg: msg ?? rest.msg,
  })
}

const createLog =
  (level: string, fn: LogFn) =>
  (objOrMsg: unknown, msg?: string): void => {
    fn(formatLogEntry(level, objOrMsg, msg))
  }

const logger = {
  level: process.env.PAYLOAD_LOG_LEVEL || 'info',
  trace: createLog('trace', console.debug),
  debug: createLog('debug', console.debug),
  info: createLog('info', console.log),
  warn: createLog('warn', console.warn),
  error: createLog('error', console.error),
  fatal: createLog('fatal', console.error),
  silent: () => {},
  child: () => logger,
}

export const cloudflareLogger = logger as unknown as NonNullable<Config['logger']>
