import { queryOptions } from '@tanstack/react-query'

import { mapWithConcurrency } from '../../lib/concurrency'
import { createLogger } from '../../lib/logger'
import { fetchJobIds, fetchJobItem, type RequestOptions } from './client'
import { type HNJobItem, type Job, toJob } from './schemas'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** Max simultaneous item requests during the fan-out. */
export const FETCH_CONCURRENCY = 10

/** How long a loaded list is considered fresh before a background refetch. */
export const JOBS_STALE_TIME_MS = 5 * 60 * 1000

const log = createLogger('jobs-query')

export class NoJobsLoadedError extends Error {
    constructor(attempted: number) {
        super(`Could not load any of the ${attempted} job postings`)
        this.name = 'NoJobsLoadedError'
    }
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * Loads every current job: fetches the ID list, then each item with bounded
 * concurrency. Individual item failures are logged and skipped. The call
 * fails only if the ID list fails, or if every item fails.
 */
export async function fetchAllJobs(options: RequestOptions = {}): Promise<Job[]> {
    const ids = await fetchJobIds(options)
    let failures = 0

    const items = await mapWithConcurrency(
        ids,
        FETCH_CONCURRENCY,
        async (id): Promise<HNJobItem | undefined> => {
            try {
                return await fetchJobItem(id, options)
            } catch (error) {
                // A cancelled query must propagate so TanStack Query can discard it.
                if (options.signal?.aborted) throw error
                failures++
                log.warn(`Giving up on item ${id}`, error)
                return undefined
            }
        },
    )

    if (ids.length > 0 && failures === ids.length) {
        throw new NoJobsLoadedError(ids.length)
    }

    const jobs = items.filter((item): item is HNJobItem => item !== undefined).map(toJob)
    log.debug(`Loaded ${jobs.length} of ${ids.length} jobs`)
    return jobs
}

// ---------------------------------------------------------------------------
// Query definition
// ---------------------------------------------------------------------------

/**
 * One query holds the full list. Search and filters run client-side on that
 * cached data, so changing them never triggers a network request.
 */
export const jobsQueryOptions = queryOptions({
    queryKey: ['hn', 'jobs'] as const,
    queryFn: ({ signal }) => fetchAllJobs({ signal }),
    staleTime: JOBS_STALE_TIME_MS,
    // The client already retries each request, so one more query-level try is enough.
    retry: 1,
})
