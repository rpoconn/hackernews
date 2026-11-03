import { useId, useState } from 'react'

import type { Job } from '../../api/hn/schemas'
import { absoluteDate, relativeTime } from '../../lib/format'
import './JobCard.css'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** Inline posting bodies longer than this start collapsed. */
export const EXCERPT_LENGTH = 240

/** "https://www.example.com/jobs" becomes "example.com". */
function displayDomain(url: string): string {
    return new URL(url).hostname.replace(/^www\./, '')
}

/** Cuts at a word boundary near `max` characters and adds an ellipsis. */
function truncate(text: string, max: number): string {
    if (text.length <= max) return text
    const cut = text.slice(0, max)
    const lastSpace = cut.lastIndexOf(' ')
    return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface JobCardProps {
    job: Job
    /** Reference time for "posted X ago"; injectable for tests. */
    now?: Date
}

export function JobCard({ job, now }: JobCardProps) {
    // --- State ---------------------------------------------------------------
    const titleId = useId()
    const [expanded, setExpanded] = useState(false)

    // --- Derived values ------------------------------------------------------
    // Postings without an external link point at the HN discussion instead.
    const primaryUrl = job.url ?? job.hnUrl
    const isLong = (job.textPlain?.length ?? 0) > EXCERPT_LENGTH
    const body =
        job.textPlain && !expanded
            ? truncate(job.textPlain, EXCERPT_LENGTH)
            : job.textPlain

    // --- Markup --------------------------------------------------------------
    return (
        <article className="job-card" aria-labelledby={titleId}>
            <div className="job-card__tags">
                {job.company && <span className="job-card__company">{job.company}</span>}
                {job.ycBatch && <span className="job-card__batch">YC {job.ycBatch}</span>}
            </div>

            <h3 id={titleId} className="job-card__title">
                <a href={primaryUrl} target="_blank" rel="noreferrer">
                    {job.title}
                </a>
            </h3>

            {body && (
                <div className="job-card__body">
                    <p>{body}</p>
                    {isLong && (
                        <button
                            type="button"
                            className="job-card__toggle"
                            aria-expanded={expanded}
                            onClick={() => setExpanded((value) => !value)}
                        >
                            {expanded ? 'Show less' : 'Show more'}
                        </button>
                    )}
                </div>
            )}

            <footer className="job-card__footer">
                <span className="job-card__meta">
                    <time
                        dateTime={job.postedAt.toISOString()}
                        title={absoluteDate(job.postedAt)}
                    >
                        {relativeTime(job.postedAt, now)}
                    </time>
                    <span aria-hidden="true"> · </span>
                    by {job.by}
                </span>
                <span className="job-card__links">
                    {job.url && (
                        <span className="job-card__domain">{displayDomain(job.url)}</span>
                    )}
                    <a href={job.hnUrl} target="_blank" rel="noreferrer">
                        HN<span className="sr-only"> discussion for {job.title}</span>
                    </a>
                </span>
            </footer>
        </article>
    )
}
