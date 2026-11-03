import { describe, expect, it } from 'vitest'

import {
    jobs,
    NOW,
    rawGooseworks,
    rawJustinTv,
    rawNango,
    rawWasmer,
} from '../../test/fixtures'
import { filterJobs, tokenize } from './filterJobs'
import { DEFAULT_JOBS_SEARCH, type JobsSearch } from './schemas'

function ids(search: Partial<JobsSearch>): number[] {
    return filterJobs(jobs, { ...DEFAULT_JOBS_SEARCH, ...search }, NOW).map(
        (job) => job.id,
    )
}

describe('tokenize', () => {
    it('lower-cases and splits on whitespace', () => {
        expect(tokenize('  Rust   ENGINEER ')).toEqual(['rust', 'engineer'])
        expect(tokenize('')).toEqual([])
    })
})

describe('filterJobs', () => {
    it('returns every job newest first by default', () => {
        expect(ids({})).toEqual([
            rawWasmer.id,
            rawNango.id,
            rawGooseworks.id,
            rawJustinTv.id,
        ])
    })

    it('sorts oldest first', () => {
        expect(ids({ sort: 'oldest' })).toEqual([
            rawJustinTv.id,
            rawGooseworks.id,
            rawNango.id,
            rawWasmer.id,
        ])
    })

    it('matches search terms case-insensitively', () => {
        expect(ids({ q: 'WASMER' })).toEqual([rawWasmer.id])
    })

    it('requires every term to match', () => {
        expect(ids({ q: 'is hiring' })).toEqual([
            rawWasmer.id,
            rawNango.id,
            rawGooseworks.id,
        ])
        expect(ids({ q: 'hiring europe' })).toEqual([rawWasmer.id])
        expect(ids({ q: 'nango marketing' })).toEqual([rawNango.id])
        expect(ids({ q: 'nango flash' })).toEqual([])
    })

    it('searches the body of inline postings', () => {
        expect(ids({ q: 'rails' })).toEqual([rawJustinTv.id])
    })

    it('filters by posted-within window', () => {
        expect(ids({ within: '7d' })).toEqual([rawWasmer.id])
        expect(ids({ within: '30d' })).toEqual([rawWasmer.id, rawNango.id])
        expect(ids({ within: '90d' })).toEqual([
            rawWasmer.id,
            rawNango.id,
            rawGooseworks.id,
        ])
    })

    it('combines search, window and sort', () => {
        expect(ids({ q: 'yc', within: '90d', sort: 'oldest' })).toEqual([
            rawGooseworks.id,
            rawNango.id,
            rawWasmer.id,
        ])
    })

    it('does not mutate the input array', () => {
        const before = jobs.map((job) => job.id)
        filterJobs(jobs, { ...DEFAULT_JOBS_SEARCH, sort: 'oldest' }, NOW)
        expect(jobs.map((job) => job.id)).toEqual(before)
    })
})
