import { beforeEach, describe, expect, it, vi } from 'vitest'

import { jsonResponse, rawJobs, rawNango, rawWasmer } from '../../test/fixtures'
import { HN_API_BASE } from './client'
import { fetchAllJobs, jobsQueryOptions, NoJobsLoadedError } from './jobsQuery'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const fast = { retryDelayMs: 0, maxAttempts: 1 }

/** Routes fetch calls by URL: the ID list, then items by ID. */
function mockApi(ids: number[], items: Record<number, unknown>) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
        const url = String(input)
        if (url === `${HN_API_BASE}/jobstories.json`) {
            return Promise.resolve(jsonResponse(ids))
        }
        const id = Number(/item\/(\d+)\.json$/.exec(url)?.[1])
        const item = items[id]
        if (item instanceof Error) return Promise.reject(item)
        return Promise.resolve(jsonResponse(item ?? null))
    })
}

beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchAllJobs', () => {
    it('loads every item in ID order and normalizes it', async () => {
        const fetchMock = mockApi(
            rawJobs.map((job) => job.id),
            Object.fromEntries(rawJobs.map((job) => [job.id, job])),
        )
        const jobs = await fetchAllJobs(fast)
        expect(jobs.map((job) => job.id)).toEqual(rawJobs.map((job) => job.id))
        expect(jobs[0]?.company).toBe('Wasmer')
        // One list request plus one per item.
        expect(fetchMock).toHaveBeenCalledTimes(rawJobs.length + 1)
    })

    it('skips missing items and items whose request fails', async () => {
        mockApi([rawWasmer.id, 999, rawNango.id], {
            [rawWasmer.id]: rawWasmer,
            [rawNango.id]: new TypeError('network down'),
        })
        const jobs = await fetchAllJobs(fast)
        expect(jobs.map((job) => job.id)).toEqual([rawWasmer.id])
    })

    it('throws when every item request fails', async () => {
        mockApi([1, 2], { 1: new TypeError('down'), 2: new TypeError('down') })
        await expect(fetchAllJobs(fast)).rejects.toBeInstanceOf(NoJobsLoadedError)
    })

    it('returns an empty list when there are no job IDs', async () => {
        mockApi([], {})
        await expect(fetchAllJobs(fast)).resolves.toEqual([])
    })

    it('never runs more than the concurrency limit at once', async () => {
        const ids = Array.from({ length: 25 }, (_, i) => i + 1)
        let inFlight = 0
        let peak = 0
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
            const url = String(input)
            if (url.endsWith('jobstories.json')) return jsonResponse(ids)
            inFlight++
            peak = Math.max(peak, inFlight)
            await new Promise((resolve) => setTimeout(resolve, 1))
            inFlight--
            return jsonResponse(null)
        })
        await fetchAllJobs(fast)
        expect(peak).toBeLessThanOrEqual(10)
        expect(peak).toBeGreaterThan(1)
    })
})

describe('jobsQueryOptions', () => {
    it('uses a stable query key', () => {
        expect(jobsQueryOptions.queryKey).toEqual(['hn', 'jobs'])
    })
})
