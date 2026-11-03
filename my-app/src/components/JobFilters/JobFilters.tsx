import { useId } from 'react'

import { type PostedWithin, PostedWithinSchema } from '../../api/hn/schemas'
import './JobFilters.css'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

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
    within: PostedWithin
    onChange: (patch: { within?: PostedWithin }) => void
}

export function JobFilters({ within, onChange }: JobFiltersProps) {
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
        </div>
    )
}
