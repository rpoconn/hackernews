import { useId } from 'react'

import {
    type JobSort,
    JobSortSchema,
    type PostedWithin,
    PostedWithinSchema,
} from '../../api/hn/schemas'
import './JobFilters.css'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const SORT_OPTIONS: ReadonlyArray<{ value: JobSort; label: string }> = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
]

const POSTED_WITHIN_OPTIONS: ReadonlyArray<{ value: PostedWithin; label: string }> = [
    { value: 'all', label: 'Any time' },
    { value: '7d', label: 'Past week' },
    { value: '30d', label: 'Past 30 days' },
    { value: '90d', label: 'Past 90 days' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface JobFiltersProps {
    sort: JobSort
    within: PostedWithin
    onChange: (patch: { sort?: JobSort; within?: PostedWithin }) => void
}

export function JobFilters({ sort, within, onChange }: JobFiltersProps) {
    const sortId = useId()
    const withinId = useId()

    return (
        <div className="job-filters">
            <div className="job-filters__field">
                <label htmlFor={withinId}>Posted</label>
                <select
                    id={withinId}
                    value={within}
                    // Parsing narrows the DOM string back to the typed union.
                    onChange={(event) =>
                        onChange({ within: PostedWithinSchema.parse(event.target.value) })
                    }
                >
                    {POSTED_WITHIN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
            <div className="job-filters__field">
                <label htmlFor={sortId}>Sort</label>
                <select
                    id={sortId}
                    value={sort}
                    onChange={(event) =>
                        onChange({ sort: JobSortSchema.parse(event.target.value) })
                    }
                >
                    {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    )
}
