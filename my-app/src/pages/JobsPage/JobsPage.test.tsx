import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { jobsQueryOptions } from '../../api/hn/jobsQuery'
import { DEFAULT_JOBS_SEARCH, type JobsSearch } from '../../api/hn/schemas'
import { jobs, jsonResponse, NOW, rawWasmer, requestUrl } from '../../test/fixtures'
import { JobsPage } from './JobsPage'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function createClient(): QueryClient {
    return new QueryClient({
        // retryDelay 0 keeps the query-level retry from slowing the error test down.
        defaultOptions: { queries: { retryDelay: 0 } },
    })
}

function renderPage({
    search = {},
    client = createClient(),
    onSearchChange = vi.fn<(patch: Partial<JobsSearch>) => void>(),
}: {
    search?: Partial<JobsSearch>
    client?: QueryClient
    onSearchChange?: (patch: Partial<JobsSearch>) => void
} = {}) {
    render(
        <QueryClientProvider client={client}>
            <JobsPage
                search={{ ...DEFAULT_JOBS_SEARCH, ...search }}
                onSearchChange={onSearchChange}
                now={NOW}
            />
        </QueryClientProvider>,
    )
    return { client, onSearchChange }
}

/** Pre-fills the cache so the page renders data without any network calls. */
function seededClient(): QueryClient {
    const client = createClient()
    client.setQueryData(jobsQueryOptions.queryKey, jobs)
    return client
}

beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JobsPage', () => {
    it('shows a loading state while jobs are fetched', () => {
        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))
        renderPage()
        expect(screen.getByRole('status')).toHaveTextContent('Loading jobs')
    })

    it('loads jobs from the API and renders a card for each', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
            Promise.resolve(
                jsonResponse(
                    requestUrl(input).endsWith('jobstories.json')
                        ? [rawWasmer.id]
                        : rawWasmer,
                ),
            ),
        )
        renderPage()
        expect(
            await screen.findByRole('link', { name: rawWasmer.title }),
        ).toBeInTheDocument()
        expect(screen.getByText('1 job')).toBeInTheDocument()
    })

    it('renders all cached jobs with a total count', () => {
        renderPage({ client: seededClient() })
        expect(screen.getAllByRole('article')).toHaveLength(jobs.length)
        expect(screen.getByText(`${jobs.length} jobs`)).toBeInTheDocument()
    })

    it('applies search and filters from props', () => {
        renderPage({ client: seededClient(), search: { q: 'wasmer' } })
        expect(screen.getAllByRole('article')).toHaveLength(1)
        expect(screen.getByText(`Showing 1 of ${jobs.length} jobs`)).toBeInTheDocument()
    })

    it('reports filter changes to the parent', () => {
        const { onSearchChange } = renderPage({ client: seededClient() })
        fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'oldest' } })
        expect(onSearchChange).toHaveBeenCalledWith({ sort: 'oldest' })
    })

    it('offers to clear filters when nothing matches', () => {
        const { onSearchChange } = renderPage({
            client: seededClient(),
            search: { q: 'zzz-no-match', within: '7d' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
        expect(onSearchChange).toHaveBeenCalledWith(DEFAULT_JOBS_SEARCH)
    })

    it('shows an error with retry when the job list cannot load', async () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(() => Promise.resolve(jsonResponse(null, 404)))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404')

        fetchMock.mockImplementation((input) =>
            Promise.resolve(
                jsonResponse(
                    requestUrl(input).endsWith('jobstories.json')
                        ? [rawWasmer.id]
                        : rawWasmer,
                ),
            ),
        )
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(
            await screen.findByRole('link', { name: rawWasmer.title }),
        ).toBeInTheDocument()
    })
})
