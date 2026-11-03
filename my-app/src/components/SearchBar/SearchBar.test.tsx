import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchBar } from './SearchBar'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

function type(text: string) {
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: text } })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SearchBar', () => {
    it('shows the committed value', () => {
        render(<SearchBar value="rust" onChange={() => {}} />)
        expect(screen.getByRole('searchbox')).toHaveValue('rust')
    })

    it('debounces changes', () => {
        const onChange = vi.fn<(value: string) => void>()
        render(<SearchBar value="" onChange={onChange} debounceMs={300} />)

        type('r')
        type('ru')
        type('rust')
        act(() => vi.advanceTimersByTime(299))
        expect(onChange).not.toHaveBeenCalled()

        act(() => vi.advanceTimersByTime(1))
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith('rust')
    })

    it('commits immediately on Enter', () => {
        const onChange = vi.fn<(value: string) => void>()
        render(<SearchBar value="" onChange={onChange} />)
        type('go')
        fireEvent.submit(screen.getByRole('search'))
        expect(onChange).toHaveBeenCalledWith('go')

        // The pending debounce must not fire a duplicate.
        act(() => vi.advanceTimersByTime(1000))
        expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('clears the query with the clear button', () => {
        const onChange = vi.fn<(value: string) => void>()
        render(<SearchBar value="rust" onChange={onChange} />)
        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
        expect(onChange).toHaveBeenCalledWith('')
        expect(screen.getByRole('searchbox')).toHaveValue('')
        expect(
            screen.queryByRole('button', { name: 'Clear search' }),
        ).not.toBeInTheDocument()
    })

    it('adopts external value changes', () => {
        const { rerender } = render(<SearchBar value="rust" onChange={() => {}} />)
        rerender(<SearchBar value="python" onChange={() => {}} />)
        expect(screen.getByRole('searchbox')).toHaveValue('python')
    })

    it('does not overwrite typing when its own value echoes back', () => {
        const onChange = vi.fn<(value: string) => void>()
        const { rerender } = render(<SearchBar value="" onChange={onChange} />)
        type('ru')
        act(() => vi.advanceTimersByTime(300))
        // User keeps typing before the parent re-renders with "ru".
        type('rus')
        rerender(<SearchBar value="ru" onChange={onChange} />)
        expect(screen.getByRole('searchbox')).toHaveValue('rus')
    })
})
