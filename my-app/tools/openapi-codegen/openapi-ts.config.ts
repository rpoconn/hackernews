import { defineConfig } from '@hey-api/openapi-ts'

// ---------------------------------------------------------------------------
// HN Search API (Algolia) client generation
//
// Reads the hand-maintained spec in `openapi/algolia-hn.yaml` and writes a typed,
// Zod-validated fetch client into the app's source tree. Run it from the app
// root with `npm run openapi:generate`.
// ---------------------------------------------------------------------------

export default defineConfig({
    input: '../../openapi/algolia-hn.yaml',
    output: {
        path: '../../src/api/hn/generated',
        // Generated files are committed, so keep them stable and readable.
        postProcess: [],
    },
    plugins: [
        // Bundles a small fetch runtime into the output, so the app needs no
        // extra runtime dependency.
        {
            name: '@hey-api/client-fetch',
            baseUrl: 'https://hn.algolia.com/api/v1',
        },
        '@hey-api/typescript',
        // Generates Zod (v4) schemas for every component and response.
        'zod',
        {
            name: '@hey-api/sdk',
            // Validate every response body against the generated Zod schema
            // before it reaches application code.
            validator: { request: false, response: 'zod' },
        },
        // The TanStack Query plugin is deliberately not enabled: the jobs page
        // loads a paged search as one infinite query
        // (`src/api/hn/jobsQuery.ts`), which per-endpoint `queryOptions` don't
        // model. Add '@tanstack/react-query' here when a page needs them.
    ],
})
