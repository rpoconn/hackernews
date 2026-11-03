import { expect, type Page, test } from '@playwright/test'

import { collectPageErrors, fixtureJobs, mockHnApi, titles } from './fixtures.ts'

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

// ---------------------------------------------------------------------------
// Mocked API: deterministic key workflows
// ---------------------------------------------------------------------------

test.describe('jobs board (mocked API)', () => {
    test('lists every job as its own card, newest first', async ({ page }) => {
        const errors = collectPageErrors(page)
        const api = await mockHnApi(page)
        await page.goto('/')

        await expect(cards(page)).toHaveCount(fixtureJobs.length)
        expect(await cardTitles(page)).toEqual([
            titles.wasmer,
            titles.nango,
            titles.gooseworks,
            titles.justin,
        ])
        await expect(page.getByText(`${fixtureJobs.length} jobs`)).toBeVisible()
        expect(api.itemRequests()).toBe(fixtureJobs.length)
        // The production CSP must allow the HN API and block nothing we rely on.
        expect(errors).toEqual([])
    })

    test('search narrows results and is kept in the URL', async ({ page }) => {
        await mockHnApi(page)
        await page.goto('/')
        await expect(cards(page)).toHaveCount(fixtureJobs.length)

        await page.getByRole('searchbox', { name: 'Search jobs' }).fill('w23')
        await expect(cards(page)).toHaveCount(2)
        await expect(page).toHaveURL(/[?&]q=w23/)
        await expect(
            page.getByText(`Showing 2 of ${fixtureJobs.length} jobs`),
        ).toBeVisible()

        // Inline posting bodies are searchable too.
        await page.getByRole('searchbox', { name: 'Search jobs' }).fill('rails')
        await expect(cards(page)).toHaveCount(1)
        await expect(cards(page).first()).toContainText('know AS3 & Rails')
    })

    test('search state survives a reload', async ({ page }) => {
        await mockHnApi(page)
        await page.goto('/?q=nango&sort=oldest')
        await expect(page.getByRole('searchbox', { name: 'Search jobs' })).toHaveValue(
            'nango',
        )
        await expect(page.getByLabel('Sort')).toHaveValue('oldest')
        await expect(cards(page)).toHaveCount(1)
    })

    test('sort order can be reversed', async ({ page }) => {
        await mockHnApi(page)
        await page.goto('/')
        await expect(cards(page)).toHaveCount(fixtureJobs.length)

        await page.getByLabel('Sort').selectOption('oldest')
        await expect(page).toHaveURL(/sort=oldest/)
        await expect(cards(page).first()).toContainText(titles.justin)
        expect(await cardTitles(page)).toEqual([
            titles.justin,
            titles.gooseworks,
            titles.nango,
            titles.wasmer,
        ])
    })

    test('posted-within filter and clear filters', async ({ page }) => {
        await mockHnApi(page)
        await page.goto('/')

        await page.getByLabel('Posted').selectOption('30d')
        await expect(cards(page)).toHaveCount(2)

        await page.getByLabel('Posted').selectOption('7d')
        await expect(cards(page)).toHaveCount(1)

        await page.getByRole('searchbox', { name: 'Search jobs' }).fill('flash')
        await expect(page.getByText('No jobs match')).toBeVisible()

        await page.getByRole('button', { name: 'Clear filters' }).click()
        await expect(cards(page)).toHaveCount(fixtureJobs.length)
        await expect(page.getByRole('searchbox', { name: 'Search jobs' })).toHaveValue('')
        await expect(page).toHaveURL(/\/$/)
    })

    test('job title links open the posting, or HN when there is no URL', async ({
        page,
    }) => {
        await mockHnApi(page)
        await page.goto('/')
        await expect(
            page.getByRole('link', { name: titles.wasmer, exact: true }),
        ).toHaveAttribute('href', fixtureJobs[0].url)
        await expect(
            page.getByRole('link', { name: titles.justin, exact: true }),
        ).toHaveAttribute('href', 'https://news.ycombinator.com/item?id=192327')
    })

    test('shows an error with retry when the API fails', async ({ page }) => {
        await mockHnApi(page, { failJobList: true })
        await page.goto('/')
        await expect(page.getByRole('alert')).toContainText('Couldn’t load jobs')

        await page.unrouteAll()
        await mockHnApi(page)
        await page.getByRole('button', { name: 'Try again' }).click()
        await expect(cards(page)).toHaveCount(fixtureJobs.length)
    })
})

// ---------------------------------------------------------------------------
// Live API smoke test (opt-in: HN_LIVE=1 npm run test:e2e)
// ---------------------------------------------------------------------------

test.describe('jobs board (live Hacker News API)', () => {
    test.skip(!process.env.HN_LIVE, 'Set HN_LIVE=1 to hit the real API')

    test('loads real job postings without CSP errors', async ({ page }) => {
        const errors = collectPageErrors(page)
        await page.goto('/')
        await expect(cards(page).first()).toBeVisible({ timeout: 30_000 })
        expect(await cards(page).count()).toBeGreaterThan(0)
        expect(errors).toEqual([])
    })
})
