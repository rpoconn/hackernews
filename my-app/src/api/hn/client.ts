import { createLogger } from '../../lib/logger'
import {
    type HNJobItem,
    HNJobItemSchema,
    HNRemovedItemSchema,
    JobIdsSchema,
} from './schemas'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0'

const log = createLogger('hn-client')

export interface RequestOptions {
    signal?: AbortSignal
    /** Total attempts per request, including the first. Defaults to 3. */
    maxAttempts?: number
    /** Base delay for exponential backoff in ms. Defaults to 300. */
    retryDelayMs?: number
}

/** Non-2xx response that was not retried or ran out of retries. */
export class HttpError extends Error {
    readonly status: number
    readonly url: string

    constructor(status: number, url: string) {
        super(`HTTP ${status} from ${url}`)
        this.name = 'HttpError'
        this.status = status
        this.url = url
    }
}

/** The response parsed as JSON but did not match the expected schema. */
export class InvalidResponseError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options)
        this.name = 'InvalidResponseError'
    }
}

// ---------------------------------------------------------------------------
// Low-level fetch with retry
// ---------------------------------------------------------------------------

function isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500
}

/** Network failures surface as TypeError; malformed JSON as SyntaxError. */
function isRetryableError(error: unknown): boolean {
    return error instanceof TypeError || error instanceof SyntaxError
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError'
}

/** Resolves after `ms`, or rejects early if `signal` aborts. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason)
            return
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort)
            resolve()
        }, ms)
        function onAbort() {
            clearTimeout(timer)
            reject(signal?.reason)
        }
        signal?.addEventListener('abort', onAbort, { once: true })
    })
}

/**
 * GETs `url` and returns the parsed JSON as `unknown`, for the caller to
 * validate. Retries network errors, malformed JSON, 429 and 5xx with
 * exponential backoff. Aborts are never retried.
 */
export async function getJson(
    url: string,
    options: RequestOptions = {},
): Promise<unknown> {
    const { signal, maxAttempts = 3, retryDelayMs = 300 } = options

    for (let attempt = 1; ; attempt++) {
        const isLastAttempt = attempt >= maxAttempts
        try {
            const response = await fetch(url, {
                signal,
                headers: { Accept: 'application/json' },
            })
            if (response.ok) {
                return (await response.json()) as unknown
            }
            if (!isRetryableStatus(response.status) || isLastAttempt) {
                throw new HttpError(response.status, url)
            }
            log.warn(`HTTP ${response.status} for ${url}, retrying (attempt ${attempt})`)
        } catch (error) {
            if (isAbortError(error) || signal?.aborted) throw error
            if (!isRetryableError(error) || isLastAttempt) throw error
            log.warn(`Request to ${url} failed, retrying (attempt ${attempt})`, error)
        }
        // 300ms, 600ms, 1200ms, ...
        await delay(retryDelayMs * 2 ** (attempt - 1), signal)
    }
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** Fetches the current job posting IDs (newest first). */
export async function fetchJobIds(options: RequestOptions = {}): Promise<number[]> {
    const url = `${HN_API_BASE}/jobstories.json`
    const parsed = JobIdsSchema.safeParse(await getJson(url, options))
    if (!parsed.success) {
        throw new InvalidResponseError('Unexpected job list format from Hacker News', {
            cause: parsed.error,
        })
    }
    return parsed.data
}

/**
 * Fetches a single job item.
 *
 * Returns `undefined` rather than throwing when the item is missing (the API
 * answers `null` with HTTP 200), deleted, dead, or malformed. One bad posting
 * should never take down the whole list.
 */
export async function fetchJobItem(
    id: number,
    options: RequestOptions = {},
): Promise<HNJobItem | undefined> {
    const body = await getJson(`${HN_API_BASE}/item/${id}.json`, options)

    if (body === null) {
        log.debug(`Item ${id} not found, skipping`)
        return undefined
    }
    if (HNRemovedItemSchema.safeParse(body).success) {
        log.debug(`Item ${id} is deleted or dead, skipping`)
        return undefined
    }

    const parsed = HNJobItemSchema.safeParse(body)
    if (!parsed.success) {
        log.warn(`Item ${id} failed validation, skipping`, parsed.error.issues)
        return undefined
    }
    return parsed.data
}
