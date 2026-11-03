import { ZodError } from 'zod'

import { createLogger } from '../../lib/logger'
import { searchByDate } from './generated'
import { client } from './generated/client.gen'
import type { SearchByDateResponses } from './generated/types.gen'

// ---------------------------------------------------------------------------
// Setup
//
// The HTTP calls themselves come from the SDK generated out of
// `openapi/algolia-hn.yaml` (see `./generated`). That SDK already validates every
// response body with Zod. This module adds what the generated code does not
// do: retries with backoff, typed errors, and job-specific narrowing.
// ---------------------------------------------------------------------------

/** Base URL baked into the generated client from the spec's `servers` entry. */
export const HN_API_BASE: string = client.getConfig().baseUrl ?? ''

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

/** The response parsed as JSON but did not match the OpenAPI schema. */
export class InvalidResponseError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options)
        this.name = 'InvalidResponseError'
    }
}

// ---------------------------------------------------------------------------
// Retry wrapper around generated SDK calls
// ---------------------------------------------------------------------------

/**
 * The shape a generated SDK function resolves to when `throwOnError` is off
 * (the default). The generated client never throws in that mode: network
 * errors, malformed JSON, non-2xx statuses and Zod validation failures all
 * come back in `error`, alongside the `Response` when there was one.
 */
type SdkResult<TData> = { request?: Request; response?: Response } & (
    { data: TData; error: undefined } | { data: undefined; error: unknown }
)

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
 * Runs a generated SDK call and returns its validated `data`. Retries network
 * errors, malformed JSON, 429 and 5xx with exponential backoff. Aborts,
 * client errors and schema mismatches are never retried.
 *
 * @param label Human-readable name of the request, used in logs and errors.
 * @param call Invokes the SDK function with the given abort signal.
 */
export async function callWithRetry<TData>(
    label: string,
    call: (signal: AbortSignal | undefined) => Promise<SdkResult<TData>>,
    options: RequestOptions = {},
): Promise<TData> {
    const { signal, maxAttempts = 3, retryDelayMs = 300 } = options

    for (let attempt = 1; ; attempt++) {
        const isLastAttempt = attempt >= maxAttempts
        const result = await call(signal)

        // TS can't narrow on this (`error: unknown` includes `undefined`), but
        // the generated client always sets a non-undefined `error` on failure
        // (`finalError || {}` in client.gen.ts), so `data` is present here.
        if (result.error === undefined) {
            return result.data as TData
        }

        const { error, request, response } = result
        if (isAbortError(error) || signal?.aborted) throw error

        if (error instanceof ZodError) {
            throw new InvalidResponseError(
                `Unexpected ${label} format from the HN Search API`,
                {
                    cause: error,
                },
            )
        }

        // A non-2xx response: the generated client puts the parsed body in
        // `error`, so the status has to be read from `response`.
        if (response && !response.ok) {
            if (!isRetryableStatus(response.status) || isLastAttempt) {
                throw new HttpError(response.status, request?.url ?? label)
            }
            log.warn(
                `HTTP ${response.status} for ${label}, retrying (attempt ${attempt})`,
            )
        } else {
            if (!isRetryableError(error) || isLastAttempt) throw error
            log.warn(`Request for ${label} failed, retrying (attempt ${attempt})`, error)
        }

        // 300ms, 600ms, 1200ms, ...
        await delay(retryDelayMs * 2 ** (attempt - 1), signal)
    }
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export type SearchResponse = SearchByDateResponses[200]

/** Jobs requested per page. */
export const JOBS_PAGE_SIZE = 50

export interface JobSearchParams {
    /** Full-text query. Empty matches every job. */
    query: string
    /** Only jobs created after this Unix time (seconds). */
    postedAfter?: number
    /** Zero-based page number. */
    page: number
}

/** Fetches one page of job posts, newest first. */
export function searchJobs(
    params: JobSearchParams,
    options: RequestOptions = {},
): Promise<SearchResponse> {
    const { query, postedAfter, page } = params
    return callWithRetry(
        'job search',
        (signal) =>
            searchByDate({
                query: {
                    tags: 'job',
                    hitsPerPage: JOBS_PAGE_SIZE,
                    page,
                    ...(query ? { query } : {}),
                    ...(postedAfter === undefined
                        ? {}
                        : { numericFilters: `created_at_i>${postedAfter}` }),
                },
                signal,
            }),
        options,
    )
}
