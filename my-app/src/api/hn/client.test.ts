import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { jsonResponse, rawWasmer } from '../../test/fixtures'
import {
    fetchJobIds,
    fetchJobItem,
    getJson,
    HN_API_BASE,
    HttpError,
    InvalidResponseError,
} from './client'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const fast = { retryDelayMs: 0 }

let fetchMock: MockInstance<typeof fetch>

beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch')
    // Retry and validation paths log warnings; keep test output clean.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
})

// ---------------------------------------------------------------------------
// getJson
// ---------------------------------------------------------------------------

describe('getJson', () => {
    it('returns parsed JSON on success', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
        await expect(getJson('https://x.test/a', fast)).resolves.toEqual({ ok: true })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('retries 5xx and 429 responses, then succeeds', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(null, 503))
            .mockResolvedValueOnce(jsonResponse(null, 429))
            .mockResolvedValueOnce(jsonResponse([1]))
        await expect(getJson('https://x.test/a', fast)).resolves.toEqual([1])
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('retries network errors and malformed JSON', async () => {
        fetchMock
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(new Response('{not json', { status: 200 }))
            .mockResolvedValueOnce(jsonResponse('ok'))
        await expect(getJson('https://x.test/a', fast)).resolves.toBe('ok')
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('gives up after maxAttempts', async () => {
        fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(null, 500)))
        await expect(
            getJson('https://x.test/a', { ...fast, maxAttempts: 2 }),
        ).rejects.toBeInstanceOf(HttpError)
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('does not retry client errors', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(null, 404))
        await expect(getJson('https://x.test/a', fast)).rejects.toMatchObject({
            status: 404,
        })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does not retry after the request is aborted', async () => {
        const controller = new AbortController()
        controller.abort()
        fetchMock.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
        await expect(
            getJson('https://x.test/a', { ...fast, signal: controller.signal }),
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
        expect(fetchMock.mock.calls[0]?.[0]).toBe(`${HN_API_BASE}/jobstories.json`)
    })

    it('throws InvalidResponseError when the payload is not an ID list', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'nope' }))
        await expect(fetchJobIds(fast)).rejects.toBeInstanceOf(InvalidResponseError)
    })
})

describe('fetchJobItem', () => {
    it('returns a validated item', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(rawWasmer))
        await expect(fetchJobItem(rawWasmer.id, fast)).resolves.toEqual(rawWasmer)
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            `${HN_API_BASE}/item/${rawWasmer.id}.json`,
        )
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
    })

    it('returns undefined and warns when the item is malformed', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, type: 'job', title: 5 }))
        await expect(fetchJobItem(1, fast)).resolves.toBeUndefined()
        expect(console.warn).toHaveBeenCalled()
    })
})
