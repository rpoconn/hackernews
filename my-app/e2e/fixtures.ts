import type { Page, Route } from '@playwright/test'

// ---------------------------------------------------------------------------
// Fixture data (real search hit shapes; times are relative to "now" so
// the "posted within" filter behaves predictably)
// ---------------------------------------------------------------------------

const DAY_SECONDS = 24 * 60 * 60
const nowSeconds = Math.floor(Date.now() / 1000)

export const fixtureJobs = [
    {
        objectID: '50300643',
        author: 'syrusakbary',
        created_at_i: nowSeconds - 2 * DAY_SECONDS,
        title: 'Wasmer (YC S19) Is Hiring OS/Hypervisor Experts in Europe',
        url: 'https://www.workatastartup.com/jobs/98722',
    },
    {
        objectID: '50280824',
        author: 'bastienbeurier',
        created_at_i: nowSeconds - 20 * DAY_SECONDS,
        title: 'Nango (YC W23) Is Hiring Across Eng, FDE, Marketing, DevRel',
        url: 'https://nango.dev/careers',
    },
    {
        objectID: '49553173',
        author: 'shivsak',
        created_at_i: nowSeconds - 60 * DAY_SECONDS,
        title: 'Gooseworks (YC W23) Is Hiring – Founding Creative Engineer',
        url: 'https://www.ycombinator.com/companies/gooseworks/jobs/rfgY8La',
    },
    {
        objectID: '192327',
        author: 'justin',
        created_at_i: nowSeconds - 400 * DAY_SECONDS,
        title: 'Justin.tv is looking for a Lead Flash Engineer!',
        url: '',
        job_text:
            'Justin.tv is the biggest live video site online.<p>We want <i>Flash</i> engineers who know AS3 &amp; Rails.',
    },
] as const

export const titles = {
    wasmer: fixtureJobs[0].title,
    nango: fixtureJobs[1].title,
    gooseworks: fixtureJobs[2].title,
    justin: fixtureJobs[3].title,
}

/** Page size used by the mock, small so two pages exist with four fixtures. */
export const MOCK_PAGE_SIZE = 2

// ---------------------------------------------------------------------------
// Network mocking
// ---------------------------------------------------------------------------

const SEARCH_URL = 'https://hn.algolia.com/api/v1/search_by_date*'

export interface MockedApi {
    /** Every search request URL seen so far, in order. */
    requests: () => URL[]
}

/**
 * Intercepts HN Search API calls and serves the fixtures, applying the same
 * `query`, `numericFilters` (`created_at_i>N`) and `page` params the real API
 * takes. Pages hold MOCK_PAGE_SIZE hits so paging is easy to exercise.
 */
export async function mockHnApi(
    page: Page,
    options: { fail?: boolean } = {},
): Promise<MockedApi> {
    const requests: URL[] = []

    await page.route(SEARCH_URL, (route: Route) => {
        const url = new URL(route.request().url())
        requests.push(url)
        if (options.fail) return route.fulfill({ status: 500, json: null })

        const query = (url.searchParams.get('query') ?? '').toLowerCase()
        const cutoff = Number(
            /created_at_i>(\d+)/.exec(
                url.searchParams.get('numericFilters') ?? '',
            )?.[1] ?? -1,
        )
        const pageNumber = Number(url.searchParams.get('page') ?? 0)

        const matches = fixtureJobs.filter((job) => {
            const text = `${job.title} ${'job_text' in job ? job.job_text : ''}`
            return job.created_at_i > cutoff && text.toLowerCase().includes(query)
        })
        const start = pageNumber * MOCK_PAGE_SIZE
        return route.fulfill({
            json: {
                hits: matches.slice(start, start + MOCK_PAGE_SIZE),
                nbHits: matches.length,
                page: pageNumber,
                nbPages: Math.ceil(matches.length / MOCK_PAGE_SIZE),
                hitsPerPage: MOCK_PAGE_SIZE,
            },
        })
    })

    return { requests: () => requests }
}

/** Collects CSP violations and uncaught errors reported by the page. */
export function collectPageErrors(page: Page): string[] {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
        if (
            message.type() === 'error' &&
            /Content Security Policy/i.test(message.text())
        ) {
            errors.push(message.text())
        }
    })
    return errors
}
