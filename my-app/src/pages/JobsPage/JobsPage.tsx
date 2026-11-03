import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { jobsInfiniteQueryOptions } from '../../api/hn/jobsQuery'
import { DEFAULT_JOBS_SEARCH, type JobsSearch } from '../../api/hn/schemas'
import { JobFilters } from '../../components/JobFilters/JobFilters'
import { JobList, type JobListState } from '../../components/JobList/JobList'
import { SearchBar } from '../../components/SearchBar/SearchBar'
import { relativeTime } from '../../lib/format'
import './JobsPage.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobsPageProps {
    /** Current search state. The route owns it and keeps it in the URL. */
    search: JobsSearch
    onSearchChange: (patch: Partial<JobsSearch>) => void
    /** Reference time for date filters and labels; injectable for tests. */
    now?: Date
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JobsPage({ search, onSearchChange, now }: JobsPageProps) {
    // --- Data ----------------------------------------------------------------
    // Captured once per mount so the "Posted within" cutoff (and so the query
    // key) doesn't change on every render. Reload or Refresh picks up new time.
    const [mountedAt] = useState(() => new Date())
    const query = useInfiniteQuery(jobsInfiniteQueryOptions(search, now ?? mountedAt))
    const data = query.data
    const loaded = data?.jobs.length ?? 0
    const total = data?.total ?? 0

    // --- Derived values ------------------------------------------------------
    const isFiltered =
        search.q !== DEFAULT_JOBS_SEARCH.q || search.within !== DEFAULT_JOBS_SEARCH.within

    // Keep showing cached jobs during a background refetch, even if it fails.
    let listState: JobListState
    if (data) {
        listState = { kind: 'ready', jobs: data.jobs }
    } else if (query.isError) {
        listState = { kind: 'error', message: query.error.message }
    } else {
        listState = { kind: 'loading' }
    }

    // --- Markup --------------------------------------------------------------
    return (
        <section className="jobs-page" aria-labelledby="jobs-page-title">
            <div className="jobs-page__intro">
                <h1 id="jobs-page-title">Y Combinator jobs</h1>
                <p>Open roles at YC startups, as posted on Hacker News.</p>
            </div>

            <div className="jobs-page__toolbar">
                <SearchBar value={search.q} onChange={(q) => onSearchChange({ q })} />
                <JobFilters within={search.within} onChange={onSearchChange} />
            </div>

            <div className="jobs-page__status">
                {/* Announced to screen readers as results change. */}
                <p aria-live="polite">
                    {data &&
                        (loaded < total
                            ? `Showing ${loaded} of ${total} jobs`
                            : `${total} ${total === 1 ? 'job' : 'jobs'}`)}
                </p>
                {data && (
                    <p className="jobs-page__updated">
                        Updated {relativeTime(new Date(query.dataUpdatedAt), now)}
                        <button
                            type="button"
                            className="jobs-page__refresh"
                            onClick={() => void query.refetch()}
                            disabled={query.isFetching}
                        >
                            {query.isFetching ? 'Refreshing…' : 'Refresh'}
                        </button>
                    </p>
                )}
            </div>

            <JobList
                state={listState}
                onRetry={() => void query.refetch()}
                onClearFilters={
                    isFiltered ? () => onSearchChange(DEFAULT_JOBS_SEARCH) : undefined
                }
                loadMore={{
                    hasMore: query.hasNextPage,
                    isLoading: query.isFetchingNextPage,
                    onLoadMore: () => void query.fetchNextPage(),
                }}
                now={now}
            />
        </section>
    )
}
