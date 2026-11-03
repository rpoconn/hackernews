import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { JobFilters, type JobFiltersProps } from './JobFilters'

describe('JobFilters', () => {
    it('reflects the current values', () => {
        render(<JobFilters sort="oldest" within="30d" onChange={() => {}} />)
        expect(screen.getByLabelText('Sort')).toHaveValue('oldest')
        expect(screen.getByLabelText('Posted')).toHaveValue('30d')
    })

    it('emits a sort change', () => {
        const onChange = vi.fn<JobFiltersProps['onChange']>()
        render(<JobFilters sort="newest" within="all" onChange={onChange} />)
        fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'oldest' } })
        expect(onChange).toHaveBeenCalledWith({ sort: 'oldest' })
    })

    it('emits a posted-within change', () => {
        const onChange = vi.fn<JobFiltersProps['onChange']>()
        render(<JobFilters sort="newest" within="all" onChange={onChange} />)
        fireEvent.change(screen.getByLabelText('Posted'), { target: { value: '7d' } })
        expect(onChange).toHaveBeenCalledWith({ within: '7d' })
    })

    it('offers every option', () => {
        render(<JobFilters sort="newest" within="all" onChange={() => {}} />)
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(
            [
                'Any time',
                'Past week',
                'Past 30 days',
                'Past 90 days',
                'Newest first',
                'Oldest first',
            ],
        )
    })
})
