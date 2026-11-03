import { describe, expect, it } from 'vitest'

import {
    NOW,
    rawGooseworks,
    rawJobs,
    rawJustinTv,
    rawWasmer,
    searchResponse,
} from '../../test/fixtures'
import { zSearchResponse } from './generated/zod.gen'
import { JobHitSchema, JobsSearchSchema, postedWithinToUnix, toJob } from './schemas'

/** Validates a raw hit the way the query does, then converts it. */
const parse = (hit: unknown) => toJob(JobHitSchema.parse(hit))

describe('JobHitSchema', () => {
    it('accepts a current-style hit and coerces objectID to a number', () => {
        expect(JobHitSchema.parse(rawWasmer).objectID).toBe(50300643)
    })

    it('accepts an old-style hit with job_text and an empty url', () => {
        expect(JobHitSchema.safeParse(rawJustinTv).success).toBe(true)
    })

    it('accepts null url and job_text, and strips unknown keys', () => {
        const parsed = JobHitSchema.parse({
            ...rawWasmer,
            url: null,
            job_text: null,
            _tags: ['job'],
        })
        expect(parsed).not.toHaveProperty('_tags')
    })

    it('rejects hits missing required fields, with a bad id, or an empty title', () => {
        expect(JobHitSchema.safeParse({ objectID: '1' }).success).toBe(false)
        expect(JobHitSchema.safeParse(null).success).toBe(false)
        expect(JobHitSchema.safeParse({ ...rawWasmer, objectID: 'abc' }).success).toBe(
            false,
        )
        expect(JobHitSchema.safeParse({ ...rawWasmer, objectID: '0' }).success).toBe(
            false,
        )
        expect(JobHitSchema.safeParse({ ...rawWasmer, title: '' }).success).toBe(false)
    })
})

describe('generated zSearchResponse (from openapi/algolia-hn.yaml)', () => {
    it('accepts a search response', () => {
        expect(zSearchResponse.safeParse(searchResponse(rawJobs)).success).toBe(true)
    })

    it('rejects a response missing paging fields', () => {
        expect(zSearchResponse.safeParse({ hits: [] }).success).toBe(false)
    })
})

describe('JobsSearchSchema', () => {
    it('fills defaults for missing params', () => {
        expect(JobsSearchSchema.parse({})).toEqual({ q: '', within: 'all' })
    })

    it('falls back to defaults for invalid values instead of throwing', () => {
        expect(JobsSearchSchema.parse({ q: 42, within: '1y' })).toEqual({
            q: '',
            within: 'all',
        })
    })

    it('keeps valid values and drops the removed sort param', () => {
        expect(
            JobsSearchSchema.parse({ q: 'rust', sort: 'oldest', within: '30d' }),
        ).toEqual({ q: 'rust', within: '30d' })
    })
})

describe('toJob', () => {
    it('parses company and YC batch from the title', () => {
        const job = parse(rawWasmer)
        expect(job.company).toBe('Wasmer')
        expect(job.ycBatch).toBe('S19')
    })

    it('leaves company and batch null when the title has no YC tag', () => {
        const job = parse(rawJustinTv)
        expect(job.company).toBeNull()
        expect(job.ycBatch).toBeNull()
    })

    it('converts unix seconds to a Date and builds the HN discussion URL', () => {
        const job = parse(rawWasmer)
        expect(job.postedAt.getTime()).toBe(rawWasmer.created_at_i * 1000)
        expect(job.hnUrl).toBe('https://news.ycombinator.com/item?id=50300643')
        expect(job.id).toBe(50300643)
        expect(job.by).toBe('syrusakbary')
    })

    it('keeps http(s) URLs and nulls out empty, null or unsafe ones', () => {
        expect(parse(rawGooseworks).url).toBe(rawGooseworks.url)
        expect(parse(rawJustinTv).url).toBeNull()
        expect(parse({ ...rawWasmer, url: 'javascript:alert(1)' }).url).toBeNull()
        expect(parse({ ...rawWasmer, url: 'not a url' }).url).toBeNull()
        expect(parse({ ...rawWasmer, url: null }).url).toBeNull()
        expect(parse({ ...rawWasmer, url: undefined }).url).toBeNull()
    })

    it('strips HTML from inline posting bodies', () => {
        expect(parse(rawJustinTv).textPlain).toBe(
            'Justin.tv is the biggest live video site online.\n\nWe want Flash engineers who know AS3 & Rails.',
        )
        expect(parse(rawWasmer).textPlain).toBeNull()
    })
})

describe('postedWithinToUnix', () => {
    const nowSeconds = NOW.getTime() / 1000

    it('returns undefined for "all"', () => {
        expect(postedWithinToUnix('all', NOW)).toBeUndefined()
    })

    it.each([
        ['7d', 7],
        ['30d', 30],
        ['90d', 90],
    ] as const)(
        '%s cuts off %i days back, rounded down to the minute',
        (within, days) => {
            const cutoff = postedWithinToUnix(within, NOW)!
            const expected = nowSeconds - days * 86_400
            expect(cutoff).toBeLessThanOrEqual(expected)
            expect(expected - cutoff).toBeLessThan(60)
            expect(cutoff % 60).toBe(0)
        },
    )
})
