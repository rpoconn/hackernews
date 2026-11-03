import type { HNJobItem, Job } from '../api/hn/schemas'
import { toJob } from '../api/hn/schemas'

// ---------------------------------------------------------------------------
// Raw HN payloads (shapes copied from real API responses)
// ---------------------------------------------------------------------------

/** Fixed "now" so date-based tests are deterministic: 2026-10-30T12:00:00Z. */
export const NOW = new Date('2026-10-30T12:00:00Z')
const NOW_SECONDS = NOW.getTime() / 1000
const DAY_SECONDS = 24 * 60 * 60

export const rawWasmer: HNJobItem = {
    by: 'syrusakbary',
    id: 50300643,
    score: 1,
    time: NOW_SECONDS - 2 * DAY_SECONDS,
    title: 'Wasmer (YC S19) Is Hiring OS/Hypervisor Experts in Europe',
    type: 'job',
    url: 'https://www.workatastartup.com/jobs/98722',
}

export const rawNango: HNJobItem = {
    by: 'bastienbeurier',
    id: 50280824,
    score: 1,
    time: NOW_SECONDS - 20 * DAY_SECONDS,
    title: 'Nango (YC W23) Is Hiring Across Eng, FDE, Marketing, DevRel',
    type: 'job',
    url: 'https://nango.dev/careers',
}

export const rawGooseworks: HNJobItem = {
    by: 'shivsak',
    id: 49553173,
    score: 1,
    time: NOW_SECONDS - 60 * DAY_SECONDS,
    title: 'Gooseworks (YC W23) Is Hiring – Founding Creative Engineer',
    type: 'job',
    url: 'https://www.ycombinator.com/companies/gooseworks/jobs/rfgY8La-founding-creative-engineer',
}

/** An old-style inline posting: HTML body, empty `url`, no YC tag. */
export const rawJustinTv: HNJobItem = {
    by: 'justin',
    id: 192327,
    score: 6,
    time: NOW_SECONDS - 400 * DAY_SECONDS,
    title: 'Justin.tv is looking for a Lead Flash Engineer!',
    type: 'job',
    url: '',
    text: 'Justin.tv is the biggest live video site online.<p>We want <i>Flash</i> engineers who know AS3 &amp; Rails.',
}

export const rawJobs: HNJobItem[] = [rawWasmer, rawNango, rawGooseworks, rawJustinTv]

export const jobs: Job[] = rawJobs.map(toJob)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a JSON `Response` the way `fetch` would return it. */
export function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}
