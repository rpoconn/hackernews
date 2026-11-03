import { z } from 'zod'

import { stripHtml } from '../../lib/format'
import { zJobHit } from './generated/zod.gen'

// ---------------------------------------------------------------------------
// Job hit schema (narrows the generated, spec-derived `JobHit` schema)
// ---------------------------------------------------------------------------

/**
 * A search hit (see `openapi/algolia-hn.yaml`) that can be shown as a job
 * card. `objectID` is the HN item ID as a string; it is coerced to a positive
 * integer so a malformed ID fails validation instead of producing `NaN`.
 * Unknown keys (`_tags`, `_highlightResult`, ...) are stripped.
 */
export const JobHitSchema = zJobHit.extend({
    objectID: z.coerce.number().int().positive(),
    title: z.string().min(1),
})

export type JobHit = z.infer<typeof JobHitSchema>

// ---------------------------------------------------------------------------
// Search / filter options (shared by the URL schema and the query)
// ---------------------------------------------------------------------------

export const PostedWithinSchema = z.enum(['7d', '30d', '90d', 'all'])
export type PostedWithin = z.infer<typeof PostedWithinSchema>

/**
 * URL search params for the jobs page. `.catch()` makes a hand-edited or
 * stale URL fall back to the defaults instead of throwing a route error.
 */
export const JobsSearchSchema = z.object({
    q: z.string().default('').catch(''),
    within: PostedWithinSchema.default('all').catch('all'),
})

export type JobsSearch = z.infer<typeof JobsSearchSchema>

export const DEFAULT_JOBS_SEARCH: JobsSearch = { q: '', within: 'all' }

// ---------------------------------------------------------------------------
// Normalized domain model (what the UI consumes)
// ---------------------------------------------------------------------------

export interface Job {
    id: number
    title: string
    /** Parsed from titles like "Acme (YC W23) Is Hiring ...". Null if absent. */
    company: string | null
    /** YC batch code such as "W23". Null if absent. */
    ycBatch: string | null
    /** External posting URL. Null when HN has none or it is not http(s). */
    url: string | null
    /** Plain-text body for inline postings (HTML stripped). */
    textPlain: string | null
    postedAt: Date
    /** Discussion page on news.ycombinator.com. */
    hnUrl: string
    by: string
}

// Matches "Company (YC S19)" at the start of a title. The batch letter covers
// W, S, F, X and any future seasons.
const YC_TITLE_PATTERN = /^(.+?)\s*\(YC ([A-Z]\d{2})\)/

/** Returns `raw` only if it is an absolute http(s) URL. */
function normalizeUrl(raw: string | undefined): string | null {
    if (!raw) return null
    try {
        const parsed = new URL(raw)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
            ? parsed.href
            : null
    } catch {
        return null
    }
}

/** Converts a validated search hit into the UI's `Job` model. */
export function toJob(hit: JobHit): Job {
    const match = YC_TITLE_PATTERN.exec(hit.title)
    const company = match?.[1]?.trim() || null
    const ycBatch = match?.[2] ?? null
    const textPlain = hit.job_text ? stripHtml(hit.job_text) || null : null

    return {
        id: hit.objectID,
        title: hit.title,
        company,
        ycBatch,
        url: normalizeUrl(hit.url ?? undefined),
        textPlain,
        postedAt: new Date(hit.created_at_i * 1000),
        hnUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        by: hit.author,
    }
}

// ---------------------------------------------------------------------------
// Date filter
// ---------------------------------------------------------------------------

const DAY_SECONDS = 24 * 60 * 60
const WITHIN_DAYS: Record<Exclude<PostedWithin, 'all'>, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
}

/**
 * Converts a "posted within" choice into the Unix-second cutoff sent to the
 * search API as `created_at_i>cutoff`. `all` means no cutoff. The result is
 * rounded down to the minute so repeated renders produce the same request.
 */
export function postedWithinToUnix(within: PostedWithin, now: Date): number | undefined {
    if (within === 'all') return undefined
    const nowSeconds = Math.floor(now.getTime() / 1000)
    const cutoff = nowSeconds - WITHIN_DAYS[within] * DAY_SECONDS
    return cutoff - (cutoff % 60)
}
