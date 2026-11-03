import type { Page, Route } from '@playwright/test'

// ---------------------------------------------------------------------------
// Fixture data (real HN shapes; times are relative to "now" so the app's
// "posted within" filter behaves predictably)
// ---------------------------------------------------------------------------

const DAY_SECONDS = 24 * 60 * 60
const nowSeconds = Math.floor(Date.now() / 1000)

export const fixtureJobs = [
    {
        by: 'syrusakbary',
        id: 50300643,
        score: 1,
        time: nowSeconds - 2 * DAY_SECONDS,
        title: 'Wasmer (YC S19) Is Hiring OS/Hypervisor Experts in Europe',
        type: 'job',
        url: 'https://www.workatastartup.com/jobs/98722',
    },
    {
        by: 'bastienbeurier',
        id: 50280824,
        score: 1,
        time: nowSeconds - 20 * DAY_SECONDS,
        title: 'Nango (YC W23) Is Hiring Across Eng, FDE, Marketing, DevRel',
        type: 'job',
        url: 'https://nango.dev/careers',
    },
    {
        by: 'shivsak',
        id: 49553173,
        score: 1,
        time: nowSeconds - 60 * DAY_SECONDS,
        title: 'Gooseworks (YC W23) Is Hiring – Founding Creative Engineer',
        type: 'job',
        url: 'https://www.ycombinator.com/companies/gooseworks/jobs/rfgY8La',
    },
    {
        by: 'justin',
        id: 192327,
        score: 6,
        time: nowSeconds - 400 * DAY_SECONDS,
        title: 'Justin.tv is looking for a Lead Flash Engineer!',
        type: 'job',
        url: '',
        text: 'Justin.tv is the biggest live video site online.<p>We want <i>Flash</i> engineers who know AS3 &amp; Rails.',
    },
] as const

export const titles = {
    wasmer: fixtureJobs[0].title,
    nango: fixtureJobs[1].title,
    gooseworks: fixtureJobs[2].title,
    justin: fixtureJobs[3].title,
}

// ---------------------------------------------------------------------------
// Network mocking
// ---------------------------------------------------------------------------

const HN_API = 'https://hacker-news.firebaseio.com/v0'

/**
 * Intercepts every Hacker News API call and serves the fixtures. A missing ID
 * returns `null`, which is what the real API does.
 */
export async function mockHnApi(
    page: Page,
    options: { failJobList?: boolean } = {},
): Promise<{ itemRequests: () => number }> {
    let itemRequests = 0

    await page.route(`${HN_API}/jobstories.json`, (route: Route) =>
        options.failJobList
            ? route.fulfill({ status: 404, json: null })
            : route.fulfill({ json: fixtureJobs.map((job) => job.id) }),
    )

    await page.route(`${HN_API}/item/*.json`, (route: Route) => {
        itemRequests++
        const id = Number(/item\/(\d+)\.json$/.exec(route.request().url())?.[1])
        return route.fulfill({ json: fixtureJobs.find((job) => job.id === id) ?? null })
    })

    return { itemRequests: () => itemRequests }
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
