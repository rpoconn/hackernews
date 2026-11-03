import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { JobFilters, type JobFiltersProps } from './JobFilters'

describe('JobFilters', () => {
    it('reflects the current value', () => {
        render(<JobFilters within="30d" onChange={() => {}} />)
        expect(screen.getByLabelText('Posted')).toHaveValue('30d')
    })

    it('has no sort control', () => {
        render(<JobFilters within="all" onChange={() => {}} />)
        expect(screen.queryByLabelText('Sort')).not.toBeInTheDocument()
    })

    it('emits a posted-within change', () => {
        const onChange = vi.fn<JobFiltersProps['onChange']>()
        render(<JobFilters within="all" onChange={onChange} />)
        fireEvent.change(screen.getByLabelText('Posted'), { target: { value: '7d' } })
        expect(onChange).toHaveBeenCalledWith({ within: '7d' })
    })

    it('offers every option', () => {
        render(<JobFilters within="all" onChange={() => {}} />)
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(
            ['Any time', 'Past week', 'Past 30 days', 'Past 90 days'],
        )
    })
})
