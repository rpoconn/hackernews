import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

import './__root.css'

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export interface RouterContext {
    queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
    component: RootLayout,
})

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function RootLayout() {
    return (
        <div className="app-shell">
            <header className="app-header">
                <a className="app-header__brand" href="/">
                    <span className="app-header__logo" aria-hidden="true">
                        Y
                    </span>
                    YC Jobs
                </a>
                <span className="app-header__tagline">
                    Startup job postings from Hacker News
                </span>
            </header>
            <main className="app-main">
                <Outlet />
            </main>
            <footer className="app-footer">
                Data from the{' '}
                <a href="https://hn.algolia.com/api" target="_blank" rel="noreferrer">
                    HN Search API by Algolia
                </a>
                .
            </footer>
        </div>
    )
}
