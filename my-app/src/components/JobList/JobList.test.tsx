import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { jobs, NOW } from '../../test/fixtures'
import { JobList } from './JobList'

describe('JobList', () => {
    it('renders one card per job, each in its own list item', () => {
        render(<JobList state={{ kind: 'ready', jobs }} onRetry={() => {}} now={NOW} />)
        const list = screen.getByRole('list', { name: 'Job postings' })
        expect(within(list).getAllByRole('listitem')).toHaveLength(jobs.length)
        expect(within(list).getAllByRole('article')).toHaveLength(jobs.length)
    })

    it('shows a loading status', () => {
        render(<JobList state={{ kind: 'loading' }} onRetry={() => {}} />)
        expect(screen.getByRole('status')).toHaveTextContent('Loading jobs')
    })

    it('shows the error and retries', () => {
        const onRetry = vi.fn<() => void>()
        render(
            <JobList state={{ kind: 'error', message: 'HTTP 503' }} onRetry={onRetry} />,
        )
        expect(screen.getByRole('alert')).toHaveTextContent('HTTP 503')
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('shows an empty state with an optional clear action', () => {
        const onClear = vi.fn<() => void>()
        const { rerender } = render(
            <JobList state={{ kind: 'ready', jobs: [] }} onRetry={() => {}} />,
        )
        expect(screen.getByText('No jobs match')).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()

        rerender(
            <JobList
                state={{ kind: 'ready', jobs: [] }}
                onRetry={() => {}}
                onClearFilters={onClear}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
        expect(onClear).toHaveBeenCalledTimes(1)
    })

    it('shows Load more only when more jobs remain, and disables it while loading', () => {
        const onLoadMore = vi.fn<() => void>()
        const state = { kind: 'ready', jobs } as const
        const { rerender } = render(
            <JobList
                state={state}
                onRetry={() => {}}
                loadMore={{ hasMore: false, isLoading: false, onLoadMore }}
            />,
        )
        expect(
            screen.queryByRole('button', { name: 'Load more' }),
        ).not.toBeInTheDocument()

        rerender(
            <JobList
                state={state}
                onRetry={() => {}}
                loadMore={{ hasMore: true, isLoading: false, onLoadMore }}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
        expect(onLoadMore).toHaveBeenCalledTimes(1)

        rerender(
            <JobList
                state={state}
                onRetry={() => {}}
                loadMore={{ hasMore: true, isLoading: true, onLoadMore }}
            />,
        )
        expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled()
    })
})
