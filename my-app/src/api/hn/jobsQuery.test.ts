import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NOW, rawJobs, rawWasmer, searchResponse } from '../../test/fixtures'
import { getNextPageParam, jobsInfiniteQueryOptions, selectJobs } from './jobsQuery'
import { DEFAULT_JOBS_SEARCH } from './schemas'

beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('getNextPageParam', () => {
    it('returns the following page while more pages remain', () => {
        expect(getNextPageParam(searchResponse([], { page: 0, nbPages: 2 }))).toBe(1)
    })

    it('stops on the last page', () => {
        expect(getNextPageParam(searchResponse([], { page: 1, nbPages: 2 }))).toBe(
            undefined,
        )
        expect(getNextPageParam(searchResponse([], { page: 0, nbPages: 1 }))).toBe(
            undefined,
        )
    })

    it('stops when the API reports nbPages 0 (past the paging cap)', () => {
        expect(getNextPageParam(searchResponse([], { page: 20, nbPages: 0 }))).toBe(
            undefined,
        )
    })
})

describe('selectJobs', () => {
    it('flattens pages in order and reports the first page total', () => {
        const data = {
            pages: [
                searchResponse(rawJobs.slice(0, 2), { nbHits: 120, nbPages: 3 }),
                searchResponse(rawJobs.slice(2), { page: 1, nbHits: 120, nbPages: 3 }),
            ],
        }
        const { jobs, total } = selectJobs(data)
        expect(jobs.map((job) => job.id)).toEqual(
            rawJobs.map((hit) => Number(hit.objectID)),
        )
        expect(total).toBe(120)
    })

    it('skips malformed hits instead of failing the list', () => {
        const bad = { ...rawWasmer, objectID: 'abc' }
        const { jobs } = selectJobs({
            pages: [searchResponse([bad, ...rawJobs.slice(1)])],
        })
        expect(jobs).toHaveLength(rawJobs.length - 1)
        expect(console.warn).toHaveBeenCalled()
    })

    it('handles no pages', () => {
        expect(selectJobs({ pages: [] })).toEqual({ jobs: [], total: 0 })
    })
})

describe('jobsInfiniteQueryOptions', () => {
    it('changes the query key with q and within', () => {
        const key = (patch: Partial<typeof DEFAULT_JOBS_SEARCH>) =>
            jobsInfiniteQueryOptions({ ...DEFAULT_JOBS_SEARCH, ...patch }, NOW).queryKey
        expect(key({})).toEqual(key({}))
        expect(key({ q: 'rust' })).not.toEqual(key({}))
        expect(key({ within: '7d' })).not.toEqual(key({}))
    })

    it('keeps the key stable as time passes', () => {
        const later = new Date(NOW.getTime() + 20_000)
        const search = { ...DEFAULT_JOBS_SEARCH, within: '7d' as const }
        expect(jobsInfiniteQueryOptions(search, later).queryKey).toEqual(
            jobsInfiniteQueryOptions(search, NOW).queryKey,
        )
    })
})
