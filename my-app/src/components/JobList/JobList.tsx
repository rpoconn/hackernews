import type { Job } from '../../api/hn/schemas'
import { JobCard } from '../JobCard/JobCard'
import './JobList.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Exactly one of these states is shown at a time. */
export type JobListState =
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; jobs: readonly Job[] }

export interface LoadMore {
    hasMore: boolean
    isLoading: boolean
    onLoadMore: () => void
}

export interface JobListProps {
    state: JobListState
    onRetry: () => void
    /** When provided, the empty state offers a "Clear filters" button. */
    onClearFilters?: () => void
    /** When provided, a "Load more" button follows the list. */
    loadMore?: LoadMore
    now?: Date
}

const SKELETON_COUNT = 6

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JobList({ state, onRetry, onClearFilters, loadMore, now }: JobListProps) {
    switch (state.kind) {
        case 'loading':
            return (
                <div className="job-list" aria-busy="true">
                    <span className="sr-only" role="status">
                        Loading jobs…
                    </span>
                    {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                        <div
                            key={index}
                            className="job-list__skeleton"
                            aria-hidden="true"
                        >
                            <span />
                            <span />
                            <span />
                        </div>
                    ))}
                </div>
            )

        case 'error':
            return (
                <div className="job-list__message job-list__message--error" role="alert">
                    <h2>Couldn’t load jobs</h2>
                    <p>{state.message}</p>
                    <button type="button" className="job-list__button" onClick={onRetry}>
                        Try again
                    </button>
                </div>
            )

        case 'ready':
            if (state.jobs.length === 0) {
                return (
                    <div className="job-list__message">
                        <h2>No jobs match</h2>
                        <p>Try a different search or widen the date range.</p>
                        {onClearFilters && (
                            <button
                                type="button"
                                className="job-list__button"
                                onClick={onClearFilters}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )
            }
            return (
                <>
                    <ul className="job-list" aria-label="Job postings">
                        {state.jobs.map((job) => (
                            <li key={job.id}>
                                <JobCard job={job} now={now} />
                            </li>
                        ))}
                    </ul>
                    {loadMore?.hasMore && (
                        <button
                            type="button"
                            className="job-list__button job-list__more"
                            onClick={loadMore.onLoadMore}
                            disabled={loadMore.isLoading}
                        >
                            {loadMore.isLoading ? 'Loading…' : 'Load more'}
                        </button>
                    )}
                </>
            )
    }
}
