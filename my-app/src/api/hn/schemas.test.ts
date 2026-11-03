import { describe, expect, it } from 'vitest'

import { rawGooseworks, rawJustinTv, rawWasmer } from '../../test/fixtures'
import {
    HNJobItemSchema,
    HNRemovedItemSchema,
    JobIdsSchema,
    JobsSearchSchema,
    toJob,
} from './schemas'

describe('HNJobItemSchema', () => {
    it('accepts a current-style job item', () => {
        expect(HNJobItemSchema.parse(rawWasmer)).toEqual(rawWasmer)
    })

    it('accepts an old-style item with text and an empty url', () => {
        expect(HNJobItemSchema.safeParse(rawJustinTv).success).toBe(true)
    })

    it('defaults score to 0 and strips unknown keys', () => {
        const { score: _score, ...rest } = rawWasmer
        const parsed = HNJobItemSchema.parse({ ...rest, kids: [1, 2] })
        expect(parsed.score).toBe(0)
        expect(parsed).not.toHaveProperty('kids')
    })

    it('rejects non-job items and items missing required fields', () => {
        expect(HNJobItemSchema.safeParse({ ...rawWasmer, type: 'story' }).success).toBe(
            false,
        )
        expect(HNJobItemSchema.safeParse({ id: 1, type: 'job' }).success).toBe(false)
        expect(HNJobItemSchema.safeParse(null).success).toBe(false)
    })
})

describe('HNRemovedItemSchema', () => {
    it('recognizes deleted and dead items', () => {
        expect(HNRemovedItemSchema.safeParse({ id: 1, deleted: true }).success).toBe(true)
        expect(HNRemovedItemSchema.safeParse({ id: 1, dead: true }).success).toBe(true)
        expect(HNRemovedItemSchema.safeParse(rawWasmer).success).toBe(false)
    })
})

describe('JobIdsSchema', () => {
    it('accepts a list of positive integers only', () => {
        expect(JobIdsSchema.parse([3, 2, 1])).toEqual([3, 2, 1])
        expect(JobIdsSchema.safeParse(['1']).success).toBe(false)
        expect(JobIdsSchema.safeParse({}).success).toBe(false)
    })
})

describe('JobsSearchSchema', () => {
    it('fills defaults for missing params', () => {
        expect(JobsSearchSchema.parse({})).toEqual({
            q: '',
            sort: 'newest',
            within: 'all',
        })
    })

    it('falls back to defaults for invalid values instead of throwing', () => {
        expect(JobsSearchSchema.parse({ q: 42, sort: 'random', within: '1y' })).toEqual({
            q: '',
            sort: 'newest',
            within: 'all',
        })
    })

    it('keeps valid values', () => {
        const search = { q: 'rust', sort: 'oldest', within: '30d' }
        expect(JobsSearchSchema.parse(search)).toEqual(search)
    })
})

describe('toJob', () => {
    it('parses company and YC batch from the title', () => {
        const job = toJob(rawWasmer)
        expect(job.company).toBe('Wasmer')
        expect(job.ycBatch).toBe('S19')
    })

    it('leaves company and batch null when the title has no YC tag', () => {
        const job = toJob(rawJustinTv)
        expect(job.company).toBeNull()
        expect(job.ycBatch).toBeNull()
    })

    it('converts unix seconds to a Date and builds the HN discussion URL', () => {
        const job = toJob(rawWasmer)
        expect(job.postedAt.getTime()).toBe(rawWasmer.time * 1000)
        expect(job.hnUrl).toBe('https://news.ycombinator.com/item?id=50300643')
    })

    it('keeps http(s) URLs and nulls out empty or unsafe ones', () => {
        expect(toJob(rawGooseworks).url).toBe(rawGooseworks.url)
        expect(toJob(rawJustinTv).url).toBeNull()
        expect(toJob({ ...rawWasmer, url: 'javascript:alert(1)' }).url).toBeNull()
        expect(toJob({ ...rawWasmer, url: 'not a url' }).url).toBeNull()
        expect(toJob({ ...rawWasmer, url: undefined }).url).toBeNull()
    })

    it('strips HTML from inline posting bodies', () => {
        const job = toJob(rawJustinTv)
        expect(job.textPlain).toBe(
            'Justin.tv is the biggest live video site online.\n\nWe want Flash engineers who know AS3 & Rails.',
        )
        expect(toJob(rawWasmer).textPlain).toBeNull()
    })

    it('builds lower-cased search text from title, company, body and poster', () => {
        const job = toJob(rawJustinTv)
        expect(job.searchText).toContain('lead flash engineer')
        expect(job.searchText).toContain('as3 & rails')
        expect(job.searchText).toContain('justin')
    })
})
