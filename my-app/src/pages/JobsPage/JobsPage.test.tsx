import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { jobsInfiniteQueryOptions } from '../../api/hn/jobsQuery'
import { DEFAULT_JOBS_SEARCH, type JobsSearch } from '../../api/hn/schemas'
import {
    infiniteData,
    jobs,
    jsonResponse,
    NOW,
    rawJobs,
    rawWasmer,
    requestUrl,
    searchResponse,
} from '../../test/fixtures'
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

/** Pre-fills the cache with loaded pages so no network call is needed. */
function seededClient(
    pages = [searchResponse(rawJobs)],
    search: Partial<JobsSearch> = {},
): QueryClient {
    const client = createClient()
    const { queryKey } = jobsInfiniteQueryOptions(
        { ...DEFAULT_JOBS_SEARCH, ...search },
        NOW,
    )
    client.setQueryData(queryKey, infiniteData(...pages))
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
        vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
            Promise.resolve(jsonResponse(searchResponse([rawWasmer]))),
        )
        renderPage()
        expect(
            await screen.findByRole('link', { name: rawWasmer.title }),
        ).toBeInTheDocument()
        expect(screen.getByText('1 job')).toBeInTheDocument()
    })

    it('renders cached jobs with a total count', () => {
        renderPage({ client: seededClient() })
        expect(screen.getAllByRole('article')).toHaveLength(jobs.length)
        expect(screen.getByText(`${jobs.length} jobs`)).toBeInTheDocument()
        expect(
            screen.queryByRole('button', { name: 'Load more' }),
        ).not.toBeInTheDocument()
    })

    it('reads the query for the current search from the cache', () => {
        renderPage({
            client: seededClient([searchResponse([rawWasmer])], { q: 'wasmer' }),
            search: { q: 'wasmer' },
        })
        expect(screen.getAllByRole('article')).toHaveLength(1)
    })

    it('shows Load more with a "Showing X of Y" count when more pages remain', () => {
        const page = searchResponse(rawJobs, { nbHits: 120, nbPages: 3 })
        renderPage({ client: seededClient([page]) })
        expect(
            screen.getByText(`Showing ${rawJobs.length} of 120 jobs`),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Load more' })).toBeEnabled()
    })

    it('fetches the next page and appends it when Load more is clicked', async () => {
        const page = searchResponse([rawWasmer], { nbHits: 2, nbPages: 2 })
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(
                jsonResponse(
                    searchResponse([rawJobs[1]!], { page: 1, nbHits: 2, nbPages: 2 }),
                ),
            )
        renderPage({ client: seededClient([page]) })
        // Seeded data is fresh, so mounting must not have fetched.
        expect(fetchMock).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
        await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
        const url = new URL(requestUrl(fetchMock.mock.calls[0]![0]))
        expect(url.searchParams.get('page')).toBe('1')
        expect(
            screen.queryByRole('button', { name: 'Load more' }),
        ).not.toBeInTheDocument()
    })

    it('has no sort control and reports date filter changes to the parent', () => {
        const { onSearchChange } = renderPage({ client: seededClient() })
        expect(screen.queryByLabelText('Sort')).not.toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('Posted'), { target: { value: '7d' } })
        expect(onSearchChange).toHaveBeenCalledWith({ within: '7d' })
    })

    it('offers to clear filters when nothing matches', () => {
        const { onSearchChange } = renderPage({
            client: seededClient([searchResponse([])], { q: 'zzz', within: '7d' }),
            search: { q: 'zzz', within: '7d' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
        expect(onSearchChange).toHaveBeenCalledWith(DEFAULT_JOBS_SEARCH)
    })

    it('shows an error with retry when the search cannot load', async () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(() => Promise.resolve(jsonResponse(null, 404)))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404')

        fetchMock.mockImplementation(() =>
            Promise.resolve(jsonResponse(searchResponse([rawWasmer]))),
        )
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(
            await screen.findByRole('link', { name: rawWasmer.title }),
        ).toBeInTheDocument()
    })
})
