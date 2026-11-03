import { type FormEvent, useEffect, useEffectEvent, useId, useRef, useState } from 'react'

import './SearchBar.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchBarProps {
    /** The committed query (e.g. from the URL). */
    value: string
    /** Called with the new query after typing pauses, on Enter, or on clear. */
    onChange: (value: string) => void
    debounceMs?: number
    placeholder?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchBar({
    value,
    onChange,
    debounceMs = 300,
    placeholder = 'Search jobs by company, role, or keyword',
}: SearchBarProps) {
    // --- State ---------------------------------------------------------------
    const inputId = useId()
    // What the user is typing. It may run ahead of `value` until the debounce fires.
    const [draft, setDraft] = useState(value)
    // The last query this component handed to `onChange`. When `value` comes
    // back equal to it, that is our own update echoing back, so the draft is
    // left alone. Otherwise a keystroke typed during navigation could be lost.
    const lastEmittedRef = useRef(value)
    const emitChange = useEffectEvent((next: string) => onChange(next))

    // --- Effects -------------------------------------------------------------

    // Adopt changes made outside the input, such as the back button or "Clear filters".
    useEffect(() => {
        if (value !== lastEmittedRef.current) {
            lastEmittedRef.current = value
            setDraft(value)
        }
    }, [value])

    // Debounce: emit only once typing has paused for `debounceMs`.
    useEffect(() => {
        if (draft === lastEmittedRef.current) return
        const timer = setTimeout(() => {
            // Enter may already have committed this draft while the timer was pending.
            if (draft === lastEmittedRef.current) return
            lastEmittedRef.current = draft
            emitChange(draft)
        }, debounceMs)
        return () => clearTimeout(timer)
    }, [draft, debounceMs])

    // --- Event handlers ------------------------------------------------------

    /** Enter commits immediately and skips the debounce. */
    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (draft !== lastEmittedRef.current) {
            lastEmittedRef.current = draft
            onChange(draft)
        }
    }

    function handleClear() {
        setDraft('')
        lastEmittedRef.current = ''
        onChange('')
    }

    // --- Markup --------------------------------------------------------------
    return (
        <form className="search-bar" role="search" onSubmit={handleSubmit}>
            <label htmlFor={inputId} className="sr-only">
                Search jobs
            </label>
            <svg className="search-bar__icon" viewBox="0 0 20 20" aria-hidden="true">
                <path
                    d="M8.5 3a5.5 5.5 0 1 0 3.4 9.83l3.63 3.63a.75.75 0 1 0 1.06-1.06l-3.63-3.63A5.5 5.5 0 0 0 8.5 3Zm-4 5.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                    fill="currentColor"
                />
            </svg>
            <input
                id={inputId}
                className="search-bar__input"
                type="search"
                value={draft}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setDraft(event.target.value)}
            />
            {draft !== '' && (
                <button
                    type="button"
                    className="search-bar__clear"
                    onClick={handleClear}
                    aria-label="Clear search"
                >
                    ×
                </button>
            )}
        </form>
    )
}
