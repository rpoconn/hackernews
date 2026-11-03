// ---------------------------------------------------------------------------
// Minimal leveled logger.
//
// Application code must log through this module rather than calling
// `console.*` directly (enforced by oxlint's `no-console` rule), so that the
// verbosity can be controlled in one place.
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
}

// Verbose in development, quiet in production builds.
const MIN_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'warn'

export interface Logger {
    debug: (message: string, ...details: unknown[]) => void
    info: (message: string, ...details: unknown[]) => void
    warn: (message: string, ...details: unknown[]) => void
    error: (message: string, ...details: unknown[]) => void
}

/** Creates a logger whose messages are prefixed with `[scope]`. */
export function createLogger(scope: string, minLevel: LogLevel = MIN_LEVEL): Logger {
    const emit =
        (level: LogLevel) =>
        (message: string, ...details: unknown[]): void => {
            if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) {
                return
            }
            console[level](`[${scope}] ${message}`, ...details)
        }

    return {
        debug: emit('debug'),
        info: emit('info'),
        warn: emit('warn'),
        error: emit('error'),
    }
}
