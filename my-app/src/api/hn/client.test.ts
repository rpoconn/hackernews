import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { jsonResponse, rawWasmer, requestUrl } from '../../test/fixtures'
import {
    fetchJobIds,
    fetchJobItem,
    HN_API_BASE,
    HttpError,
    InvalidResponseError,
} from './client'

// ---------------------------------------------------------------------------
// Setup
//
// These tests exercise the real generated SDK and only mock `fetch`, so they
// also cover URL building and Zod response validation from the spec.
// ---------------------------------------------------------------------------

const fast = { retryDelayMs: 0 }

let fetchMock: MockInstance<typeof fetch>

/** URL of the n-th mocked fetch call. */
function calledUrl(n = 0): string | undefined {
    const input = fetchMock.mock.calls[n]?.[0]
    return input === undefined ? undefined : requestUrl(input)
}

beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch')
    // Retry and validation paths log warnings; keep test output clean.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
})

// ---------------------------------------------------------------------------
// Generated client configuration
// ---------------------------------------------------------------------------

describe('HN_API_BASE', () => {
    it('comes from the spec servers entry', () => {
        expect(HN_API_BASE).toBe('https://hacker-news.firebaseio.com/v0')
    })
})

// ---------------------------------------------------------------------------
// Retry behavior (exercised through fetchJobIds)
// ---------------------------------------------------------------------------

describe('retries', () => {
    it('retries 5xx and 429 responses, then succeeds', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(null, 503))
            .mockResolvedValueOnce(jsonResponse(null, 429))
            .mockResolvedValueOnce(jsonResponse([1]))
        await expect(fetchJobIds(fast)).resolves.toEqual([1])
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
            .mockResolvedValueOnce(jsonResponse([2, 1]))
        await expect(fetchJobIds(fast)).resolves.toEqual([2, 1])
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('gives up after maxAttempts with an HttpError carrying the URL', async () => {
        fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(null, 500)))
        const error = await fetchJobIds({ ...fast, maxAttempts: 2 }).catch(
            (e: unknown) => e,
        )
        expect(error).toBeInstanceOf(HttpError)
        expect(error).toMatchObject({
            status: 500,
            url: `${HN_API_BASE}/jobstories.json`,
        })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('does not retry client errors', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(null, 404))
        await expect(fetchJobIds(fast)).rejects.toMatchObject({ status: 404 })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does not retry schema mismatches', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }))
        await expect(fetchJobIds(fast)).rejects.toBeInstanceOf(InvalidResponseError)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does not retry after the request is aborted', async () => {
        const controller = new AbortController()
        controller.abort()
        fetchMock.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
        await expect(
            fetchJobIds({ ...fast, signal: controller.signal }),
        ).rejects.toMatchObject({ name: 'AbortError' })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

describe('fetchJobIds', () => {
    it('requests jobstories.json and returns the IDs', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse([3, 2, 1]))
        await expect(fetchJobIds(fast)).resolves.toEqual([3, 2, 1])
        expect(calledUrl()).toBe(`${HN_API_BASE}/jobstories.json`)
    })

    it('rejects IDs that are not positive integers', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse([1, 0]))
        await expect(fetchJobIds(fast)).rejects.toBeInstanceOf(InvalidResponseError)
    })

    it('forwards the abort signal to fetch', async () => {
        const controller = new AbortController()
        fetchMock.mockResolvedValueOnce(jsonResponse([1]))
        await fetchJobIds({ ...fast, signal: controller.signal })
        const request = fetchMock.mock.calls[0]?.[0]
        expect(request).toBeInstanceOf(Request)
        controller.abort()
        expect((request as Request).signal.aborted).toBe(true)
    })
})

describe('fetchJobItem', () => {
    it('returns a validated item', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(rawWasmer))
        await expect(fetchJobItem(rawWasmer.id, fast)).resolves.toEqual(rawWasmer)
        expect(calledUrl()).toBe(`${HN_API_BASE}/item/${rawWasmer.id}.json`)
    })

    it('returns undefined when the API answers null', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(null))
        await expect(fetchJobItem(1, fast)).resolves.toBeUndefined()
    })

    it('returns undefined for deleted and dead items', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ id: 1, deleted: true, type: 'job' }))
            .mockResolvedValueOnce(jsonResponse({ ...rawWasmer, dead: true }))
        await expect(fetchJobItem(1, fast)).resolves.toBeUndefined()
        await expect(fetchJobItem(rawWasmer.id, fast)).resolves.toBeUndefined()
        expect(console.warn).not.toHaveBeenCalled()
    })

    it('returns undefined and warns when the item breaks the spec', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, type: 'job', title: 5 }))
        await expect(fetchJobItem(1, fast)).resolves.toBeUndefined()
        expect(console.warn).toHaveBeenCalled()
    })

    it('returns undefined and warns for valid items that are not jobs', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ ...rawWasmer, type: 'story' }))
        await expect(fetchJobItem(rawWasmer.id, fast)).resolves.toBeUndefined()
        expect(console.warn).toHaveBeenCalled()
    })

    it('still throws HTTP errors so the caller can count the failure', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(null, 403))
        await expect(fetchJobItem(1, fast)).rejects.toBeInstanceOf(HttpError)
    })
})
