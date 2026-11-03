import { expect, type Page, test } from '@playwright/test'

import {
    collectPageErrors,
    fixtureJobs,
    MOCK_PAGE_SIZE,
    mockHnApi,
    titles,
} from './fixtures.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cards(page: Page) {
    return page.getByRole('list', { name: 'Job postings' }).getByRole('article')
}

/** Card titles in on-screen order. */
async function cardTitles(page: Page): Promise<string[]> {
    return cards(page).getByRole('heading').allTextContents()
}

function searchbox(page: Page) {
    return page.getByRole('searchbox', { name: 'Search jobs' })
}

/** Loads every page so assertions can see all fixtures. */
async function loadAll(page: Page) {
    await page.getByRole('button', { name: 'Load more' }).click()
    await expect(cards(page)).toHaveCount(fixtureJobs.length)
}

// ---------------------------------------------------------------------------
// Mocked API: deterministic key workflows
// ---------------------------------------------------------------------------

test.describe('jobs board (mocked API)', () => {
    test('lists the first page of jobs, newest first, with a total', async ({ page }) => {
        const errors = collectPageErrors(page)
        const api = await mockHnApi(page)
        await page.goto('/')

        await expect(cards(page)).toHaveCount(MOCK_PAGE_SIZE)
        expect(await cardTitles(page)).toEqual([titles.wasmer, titles.nango])
        await expect(
            page.getByText(`Showing ${MOCK_PAGE_SIZE} of ${fixtureJobs.length} jobs`),
        ).toBeVisible()
        // One request per page, no per-item fan-out.
        expect(api.requests()).toHaveLength(1)
        expect(api.requests()[0]?.searchParams.get('tags')).toBe('job')
        // The production CSP must allow the search API and block nothing we rely on.
        expect(errors).toEqual([])
    })

    test('Load more appends the next page and hides on the last page', async ({
        page,
    }) => {
        const api = await mockHnApi(page)
        await page.goto('/')
        await expect(cards(page)).toHaveCount(MOCK_PAGE_SIZE)

        await page.getByRole('button', { name: 'Load more' }).click()
        await expect(cards(page)).toHaveCount(fixtureJobs.length)
        expect(await cardTitles(page)).toEqual([
            titles.wasmer,
            titles.nango,
            titles.gooseworks,
            titles.justin,
        ])
        await expect(page.getByRole('button', { name: 'Load more' })).toBeHidden()
        await expect(page.getByText(`${fixtureJobs.length} jobs`)).toBeVisible()
        expect(api.requests().map((url) => url.searchParams.get('page'))).toEqual([
            '0',
            '1',
        ])
    })

    test('search runs on the server and is kept in the URL', async ({ page }) => {
        const api = await mockHnApi(page)
        await page.goto('/')
        await expect(cards(page)).toHaveCount(MOCK_PAGE_SIZE)

        await searchbox(page).fill('w23')
        await expect(cards(page)).toHaveCount(2)
        await expect(page).toHaveURL(/[?&]q=w23/)
        expect(await cardTitles(page)).toEqual([titles.nango, titles.gooseworks])
        expect(api.requests().at(-1)?.searchParams.get('query')).toBe('w23')

        // Inline posting bodies are searchable too.
        await searchbox(page).fill('rails')
        await expect(cards(page)).toHaveCount(1)
        await expect(cards(page).first()).toContainText('know AS3 & Rails')
        expect(api.requests().at(-1)?.searchParams.get('query')).toBe('rails')
    })

    test('search state survives a reload', async ({ page }) => {
        await mockHnApi(page)
        await page.goto('/?q=nango&within=30d')
        await expect(searchbox(page)).toHaveValue('nango')
        await expect(page.getByLabel('Posted')).toHaveValue('30d')
        await expect(cards(page)).toHaveCount(1)
    })

    test('there is no sort control', async ({ page }) => {
        await mockHnApi(page)
        await page.goto('/')
        await expect(cards(page)).toHaveCount(MOCK_PAGE_SIZE)
        await expect(page.getByLabel('Sort')).toHaveCount(0)
    })

    test('posted-within filter sends a cutoff; clear filters resets', async ({
        page,
    }) => {
        const api = await mockHnApi(page)
        await page.goto('/')
        await expect(cards(page)).toHaveCount(MOCK_PAGE_SIZE)

        await page.getByLabel('Posted').selectOption('30d')
        await expect(cards(page)).toHaveCount(2)
        expect(api.requests().at(-1)?.searchParams.get('numericFilters')).toMatch(
            /^created_at_i>\d+$/,
        )

        await page.getByLabel('Posted').selectOption('7d')
        await expect(cards(page)).toHaveCount(1)

        await searchbox(page).fill('flash')
        await expect(page.getByText('No jobs match')).toBeVisible()

        await page.getByRole('button', { name: 'Clear filters' }).click()
        await expect(cards(page)).toHaveCount(MOCK_PAGE_SIZE)
        await expect(searchbox(page)).toHaveValue('')
        await expect(page).toHaveURL(/\/$/)
    })

    test('job title links open the posting, or HN when there is no URL', async ({
        page,
    }) => {
        await mockHnApi(page)
        await page.goto('/')
        await loadAll(page)
        await expect(
            page.getByRole('link', { name: titles.wasmer, exact: true }),
        ).toHaveAttribute('href', fixtureJobs[0].url)
        await expect(
            page.getByRole('link', { name: titles.justin, exact: true }),
        ).toHaveAttribute('href', 'https://news.ycombinator.com/item?id=192327')
    })

    test('shows an error with retry when the API fails', async ({ page }) => {
        await mockHnApi(page, { fail: true })
        await page.goto('/')
        await expect(page.getByRole('alert')).toContainText('Couldn’t load jobs')

        await page.unrouteAll()
        await mockHnApi(page)
        await page.getByRole('button', { name: 'Try again' }).click()
        await expect(cards(page)).toHaveCount(MOCK_PAGE_SIZE)
    })
})

// ---------------------------------------------------------------------------
// Live API smoke test (opt-in: HN_LIVE=1 npm run test:e2e)
// ---------------------------------------------------------------------------

test.describe('jobs board (live HN Search API)', () => {
    test.skip(!process.env.HN_LIVE, 'Set HN_LIVE=1 to hit the real API')

    test('loads more than 30 postings, pages, and has no CSP errors', async ({
        page,
    }) => {
        const errors = collectPageErrors(page)
        await page.goto('/')
        await expect(cards(page).first()).toBeVisible({ timeout: 30_000 })
        // The old Firebase list was capped at ~30; Algolia pages hold 50.
        expect(await cards(page).count()).toBeGreaterThan(30)

        const before = await cards(page).count()
        await page.getByRole('button', { name: 'Load more' }).click()
        await expect(async () => {
            expect(await cards(page).count()).toBeGreaterThan(before)
        }).toPass({ timeout: 30_000 })
        expect(errors).toEqual([])
    })
})
