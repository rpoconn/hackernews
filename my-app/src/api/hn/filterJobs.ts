import type { Job, JobsSearch, PostedWithin } from './schemas'

const DAY_MS = 24 * 60 * 60 * 1000

/** Age limit for each "posted within" option; `null` means no limit. */
const POSTED_WITHIN_MS: Record<PostedWithin, number | null> = {
    '7d': 7 * DAY_MS,
    '30d': 30 * DAY_MS,
    '90d': 90 * DAY_MS,
    all: null,
}

/** Splits a query into lower-cased words. Every word must match. */
export function tokenize(query: string): string[] {
    return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/**
 * Applies search, the "posted within" filter and sorting. Pure: it returns
 * a new array and never mutates `jobs`. `now` is injectable for tests.
 */
export function filterJobs(
    jobs: readonly Job[],
    search: JobsSearch,
    now: Date = new Date(),
): Job[] {
    const terms = tokenize(search.q)
    const maxAge = POSTED_WITHIN_MS[search.within]
    const cutoff = maxAge === null ? null : now.getTime() - maxAge

    const filtered = jobs.filter((job) => {
        if (cutoff !== null && job.postedAt.getTime() < cutoff) return false
        return terms.every((term) => job.searchText.includes(term))
    })

    const direction = search.sort === 'newest' ? -1 : 1
    return filtered.sort(
        (a, b) => direction * (a.postedAt.getTime() - b.postedAt.getTime()),
    )
}
