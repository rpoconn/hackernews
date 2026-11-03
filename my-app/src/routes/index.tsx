import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { useCallback } from 'react'

import { DEFAULT_JOBS_SEARCH, type JobsSearch, JobsSearchSchema } from '../api/hn/schemas'
import { JobsPage } from '../pages/JobsPage/JobsPage'

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/')({
    // Zod implements Standard Schema, so the router validates ?q=&sort=&within= directly.
    validateSearch: JobsSearchSchema,
    // Leave default values out of the URL, so the plain "/" stays clean.
    search: { middlewares: [stripSearchParams(DEFAULT_JOBS_SEARCH)] },
    component: JobsRoute,
})

// ---------------------------------------------------------------------------
// Component: adapts URL state to the page's plain props
// ---------------------------------------------------------------------------

function JobsRoute() {
    const search = Route.useSearch()
    const navigate = Route.useNavigate()

    const handleSearchChange = useCallback(
        (patch: Partial<JobsSearch>) => {
            void navigate({
                search: (prev) => ({ ...prev, ...patch }),
                // Typing replaces the history entry, so Back skips each
                // keystroke. Filter changes push a new entry.
                replace: Object.keys(patch).length === 1 && 'q' in patch,
            })
        },
        [navigate],
    )

    return <JobsPage search={search} onSearchChange={handleSearchChange} />
}
