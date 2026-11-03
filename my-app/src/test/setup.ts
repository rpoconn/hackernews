// Adds DOM matchers such as `toBeInTheDocument()` to vitest's `expect`.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount rendered trees between tests so queries never see stale DOM.
afterEach(() => {
    cleanup()
})
