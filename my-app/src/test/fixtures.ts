import { JOBS_PAGE_SIZE, type SearchResponse } from '../api/hn/client'
import { type Job, JobHitSchema, toJob } from '../api/hn/schemas'

// ---------------------------------------------------------------------------
// Raw search hits (shapes copied from real API responses)
// ---------------------------------------------------------------------------

/** Fixed "now" so date-based tests are deterministic: 2026-10-30T12:00:00Z. */
export const NOW = new Date('2026-10-30T12:00:00Z')
const NOW_SECONDS = NOW.getTime() / 1000
const DAY_SECONDS = 24 * 60 * 60

export type RawHit = SearchResponse['hits'][number]

export const rawWasmer: RawHit = {
    objectID: '50300643',
    author: 'syrusakbary',
    created_at_i: NOW_SECONDS - 2 * DAY_SECONDS,
    title: 'Wasmer (YC S19) Is Hiring OS/Hypervisor Experts in Europe',
    url: 'https://www.workatastartup.com/jobs/98722',
}

export const rawNango: RawHit = {
    objectID: '50280824',
    author: 'bastienbeurier',
    created_at_i: NOW_SECONDS - 20 * DAY_SECONDS,
    title: 'Nango (YC W23) Is Hiring Across Eng, FDE, Marketing, DevRel',
    url: 'https://nango.dev/careers',
}

export const rawGooseworks: RawHit = {
    objectID: '49553173',
    author: 'shivsak',
    created_at_i: NOW_SECONDS - 60 * DAY_SECONDS,
    title: 'Gooseworks (YC W23) Is Hiring – Founding Creative Engineer',
    url: 'https://www.ycombinator.com/companies/gooseworks/jobs/rfgY8La-founding-creative-engineer',
}

/** An old-style inline posting: HTML body, empty `url`, no YC tag. */
export const rawJustinTv: RawHit = {
    objectID: '192327',
    author: 'justin',
    created_at_i: NOW_SECONDS - 400 * DAY_SECONDS,
    title: 'Justin.tv is looking for a Lead Flash Engineer!',
    url: '',
    job_text:
        'Justin.tv is the biggest live video site online.<p>We want <i>Flash</i> engineers who know AS3 &amp; Rails.',
}

export const rawJobs: RawHit[] = [rawWasmer, rawNango, rawGooseworks, rawJustinTv]

export const jobs: Job[] = rawJobs.map((hit) => toJob(JobHitSchema.parse(hit)))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a search API response; paging fields default to a single full page. */
export function searchResponse(
    hits: readonly RawHit[],
    { page = 0, nbPages = 1, nbHits = hits.length } = {},
): SearchResponse {
    return { hits: [...hits], nbHits, page, nbPages, hitsPerPage: JOBS_PAGE_SIZE }
}

/** The cached shape of an infinite query that has loaded the given pages. */
export function infiniteData(...pages: SearchResponse[]) {
    return { pages, pageParams: pages.map((_, index) => index) }
}

/**
 * URL of a mocked `fetch` call. The generated client passes a `Request`
 * object rather than a URL string, so `String(input)` is not enough.
 */
export function requestUrl(input: Parameters<typeof fetch>[0]): string {
    return input instanceof Request ? input.url : String(input)
}

/** Builds a JSON `Response` the way `fetch` would return it. */
export function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}
