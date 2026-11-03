import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { jsonResponse, rawWasmer, requestUrl, searchResponse } from '../../test/fixtures'
import {
    HN_API_BASE,
    HttpError,
    InvalidResponseError,
    JOBS_PAGE_SIZE,
    searchJobs,
} from './client'

// ---------------------------------------------------------------------------
// Setup
//
// These tests exercise the real generated SDK and only mock `fetch`, so they
// also cover URL building and Zod response validation from the spec.
// ---------------------------------------------------------------------------

const fast = { retryDelayMs: 0 }
const firstPage = { query: '', page: 0 }

let fetchMock: MockInstance<typeof fetch>

/** Parsed URL of the n-th mocked fetch call. */
function calledUrl(n = 0): URL {
    const input = fetchMock.mock.calls[n]?.[0]
    if (input === undefined) throw new Error(`fetch call ${n} was not made`)
    return new URL(requestUrl(input))
}

beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch')
    // Retry paths log warnings; keep test output clean.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

// ---------------------------------------------------------------------------
// Generated client configuration
// ---------------------------------------------------------------------------

describe('HN_API_BASE', () => {
    it('comes from the spec servers entry', () => {
        expect(HN_API_BASE).toBe('https://hn.algolia.com/api/v1')
    })
})

// ---------------------------------------------------------------------------
// searchJobs: request building
// ---------------------------------------------------------------------------

describe('searchJobs', () => {
    it('requests job posts with the page size and page', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(searchResponse([rawWasmer])))
        const response = await searchJobs({ query: '', page: 3 }, fast)

        const url = calledUrl()
        expect(url.origin + url.pathname).toBe(`${HN_API_BASE}/search_by_date`)
        expect(url.searchParams.get('tags')).toBe('job')
        expect(url.searchParams.get('hitsPerPage')).toBe(String(JOBS_PAGE_SIZE))
        expect(url.searchParams.get('page')).toBe('3')
        expect(response.hits).toHaveLength(1)
    })

    it('omits query and numericFilters when they are not set', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(searchResponse([])))
        await searchJobs(firstPage, fast)
        expect(calledUrl().searchParams.has('query')).toBe(false)
        expect(calledUrl().searchParams.has('numericFilters')).toBe(false)
    })

    it('sends the query and a created_at_i cutoff', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(searchResponse([])))
        await searchJobs({ query: 'rust', postedAfter: 1700000000, page: 0 }, fast)
        expect(calledUrl().searchParams.get('query')).toBe('rust')
        expect(calledUrl().searchParams.get('numericFilters')).toBe(
            'created_at_i>1700000000',
        )
    })

    it('forwards the abort signal to fetch', async () => {
        const controller = new AbortController()
        fetchMock.mockResolvedValueOnce(jsonResponse(searchResponse([])))
        await searchJobs(firstPage, { ...fast, signal: controller.signal })
        const request = fetchMock.mock.calls[0]?.[0]
        expect(request).toBeInstanceOf(Request)
        controller.abort()
        expect((request as Request).signal.aborted).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// Retry behavior and error mapping
// ---------------------------------------------------------------------------

describe('retries', () => {
    it('retries 5xx and 429 responses, then succeeds', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(null, 503))
            .mockResolvedValueOnce(jsonResponse(null, 429))
            .mockResolvedValueOnce(jsonResponse(searchResponse([rawWasmer])))
        await expect(searchJobs(firstPage, fast)).resolves.toMatchObject({ nbHits: 1 })
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('retries network errors and malformed JSON', async () => {
        fetchMock
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(
                new Response('{not json', {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }),
            )
            .mockResolvedValueOnce(jsonResponse(searchResponse([])))
        await expect(searchJobs(firstPage, fast)).resolves.toMatchObject({ nbHits: 0 })
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('gives up after maxAttempts with an HttpError carrying the URL', async () => {
        fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(null, 500)))
        const error = await searchJobs(firstPage, { ...fast, maxAttempts: 2 }).catch(
            (e: unknown) => e,
        )
        expect(error).toBeInstanceOf(HttpError)
        expect(error).toMatchObject({ status: 500 })
        expect((error as HttpError).url).toContain(`${HN_API_BASE}/search_by_date`)
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('does not retry client errors', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(null, 404))
        await expect(searchJobs(firstPage, fast)).rejects.toMatchObject({ status: 404 })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('throws InvalidResponseError, without retrying, on a bad body', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }))
        await expect(searchJobs(firstPage, fast)).rejects.toBeInstanceOf(
            InvalidResponseError,
        )
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does not retry after the request is aborted', async () => {
        const controller = new AbortController()
        controller.abort()
        fetchMock.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
        await expect(
            searchJobs(firstPage, { ...fast, signal: controller.signal }),
        ).rejects.toMatchObject({ name: 'AbortError' })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
