import { z } from 'zod'

import { stripHtml } from '../../lib/format'

// ---------------------------------------------------------------------------
// Raw API schemas (validate exactly what the HN Firebase API returns)
// ---------------------------------------------------------------------------

/** `GET /v0/jobstories.json`: up to 200 item IDs, newest first. */
export const JobIdsSchema = z.array(z.number().int().positive())

/**
 * `GET /v0/item/{id}.json` for an item of type "job".
 *
 * Observed shapes (Oct 2026):
 *  - Current jobs: `by, id, score, time, title, type, url`.
 *  - Older jobs: `text` holds an HTML body and `url` is an empty string.
 * Unknown keys are stripped.
 */
export const HNJobItemSchema = z.object({
    id: z.number().int().positive(),
    by: z.string(),
    /** Unix time in seconds. */
    time: z.number().int().nonnegative(),
    title: z.string().min(1),
    type: z.literal('job'),
    score: z.number().int().default(0),
    url: z.string().optional(),
    text: z.string().optional(),
})

export type HNJobItem = z.infer<typeof HNJobItemSchema>

/**
 * Deleted or killed items keep their ID but lose most fields. This is checked
 * before full validation so they can be skipped quietly instead of logged as
 * malformed.
 */
export const HNRemovedItemSchema = z.union([
    z.object({ deleted: z.literal(true) }),
    z.object({ dead: z.literal(true) }),
])

// ---------------------------------------------------------------------------
// Search / filter options (shared by the URL schema and the filter logic)
// ---------------------------------------------------------------------------

export const JobSortSchema = z.enum(['newest', 'oldest'])
export type JobSort = z.infer<typeof JobSortSchema>

export const PostedWithinSchema = z.enum(['7d', '30d', '90d', 'all'])
export type PostedWithin = z.infer<typeof PostedWithinSchema>

/**
 * URL search params for the jobs page. `.catch()` makes a hand-edited or
 * stale URL fall back to the defaults instead of throwing a route error.
 */
export const JobsSearchSchema = z.object({
    q: z.string().default('').catch(''),
    sort: JobSortSchema.default('newest').catch('newest'),
    within: PostedWithinSchema.default('all').catch('all'),
})

export type JobsSearch = z.infer<typeof JobsSearchSchema>

export const DEFAULT_JOBS_SEARCH: JobsSearch = { q: '', sort: 'newest', within: 'all' }

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
    /** Lower-cased title + company + body + poster, precomputed for search. */
    searchText: string
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

/** Converts a validated HN item into the UI's `Job` model. */
export function toJob(item: HNJobItem): Job {
    const match = YC_TITLE_PATTERN.exec(item.title)
    const company = match?.[1]?.trim() || null
    const ycBatch = match?.[2] ?? null
    const textPlain = item.text ? stripHtml(item.text) || null : null

    return {
        id: item.id,
        title: item.title,
        company,
        ycBatch,
        url: normalizeUrl(item.url),
        textPlain,
        postedAt: new Date(item.time * 1000),
        hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
        by: item.by,
        searchText: [item.title, company, textPlain, item.by]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
    }
}
