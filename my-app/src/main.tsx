import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import { routeTree } from './routeTree.gen'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Job postings change slowly; avoid refetching on every tab focus.
            refetchOnWindowFocus: false,
        },
    },
})

const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
})

// Registers the router type globally so `useSearch`, `Link`, etc. are typed.
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const rootElement = document.getElementById('root')
if (!rootElement) {
    throw new Error('Missing #root element in index.html')
}

createRoot(rootElement).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    </StrictMode>,
)
