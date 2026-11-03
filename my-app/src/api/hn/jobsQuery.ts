import { infiniteQueryOptions } from '@tanstack/react-query'

import { createLogger } from '../../lib/logger'
import { JOBS_PAGE_SIZE, type SearchResponse, searchJobs } from './client'
import { JobHitSchema, type JobsSearch, postedWithinToUnix, toJob } from './schemas'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export { JOBS_PAGE_SIZE }

/** How long a loaded list is considered fresh before a background refetch. */
export const JOBS_STALE_TIME_MS = 5 * 60 * 1000

const log = createLogger('jobs-query')

// ---------------------------------------------------------------------------
// Page handling
// ---------------------------------------------------------------------------

/**
 * Next page number, or undefined on the last page. The API reports
 * `nbPages: 0` once paging passes its 1,000-hit cap, which also ends here.
 */
export function getNextPageParam(last: SearchResponse): number | undefined {
    return last.page + 1 < last.nbPages ? last.page + 1 : undefined
}

/**
 * Flattens loaded pages into jobs. A hit that fails validation is logged and
 * skipped, so one bad posting never takes down the list.
 */
export function selectJobs(data: { pages: readonly SearchResponse[] }) {
    const jobs = data.pages.flatMap((page) =>
        page.hits.flatMap((hit) => {
            const parsed = JobHitSchema.safeParse(hit)
            if (!parsed.success) {
                log.warn(`Skipping malformed hit ${hit.objectID}`, parsed.error.issues)
                return []
            }
            return [toJob(parsed.data)]
        }),
    )
    return { jobs, total: data.pages[0]?.nbHits ?? 0 }
}

// ---------------------------------------------------------------------------
// Query definition
// ---------------------------------------------------------------------------

/**
 * One infinite query per (search text, date range). Both run on the server,
 * so changing either starts a fresh query; "Load more" fetches the next page.
 */
export function jobsInfiniteQueryOptions(search: JobsSearch, now: Date) {
    const postedAfter = postedWithinToUnix(search.within, now)
    return infiniteQueryOptions({
        // The cutoff is derived from `within`, so it is deliberately not in the key.
        queryKey: ['hn', 'jobs', { q: search.q, within: search.within }] as const,
        queryFn: ({ pageParam, signal }) =>
            searchJobs({ query: search.q, postedAfter, page: pageParam }, { signal }),
        initialPageParam: 0,
        getNextPageParam,
        select: selectJobs,
        staleTime: JOBS_STALE_TIME_MS,
        // The client already retries each request, so one more query-level try is enough.
        retry: 1,
    })
}
