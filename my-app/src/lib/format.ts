// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** Formats `date` relative to `now`, e.g. "3 days ago" or "last month". */
export function relativeTime(date: Date, now: Date = new Date()): string {
    const diff = date.getTime() - now.getTime()
    const abs = Math.abs(diff)

    if (abs < MINUTE) return 'just now'
    if (abs < HOUR) return relativeFormatter.format(Math.round(diff / MINUTE), 'minute')
    if (abs < DAY) return relativeFormatter.format(Math.round(diff / HOUR), 'hour')
    if (abs < WEEK) return relativeFormatter.format(Math.round(diff / DAY), 'day')
    if (abs < MONTH) return relativeFormatter.format(Math.round(diff / WEEK), 'week')
    if (abs < YEAR) return relativeFormatter.format(Math.round(diff / MONTH), 'month')
    return relativeFormatter.format(Math.round(diff / YEAR), 'year')
}

const absoluteFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

/** Formats a date as e.g. "Oct 30, 2026". */
export function absoluteDate(date: Date): string {
    return absoluteFormatter.format(date)
}

// ---------------------------------------------------------------------------
// HTML to plain text
// ---------------------------------------------------------------------------

/**
 * Converts an HN HTML fragment into plain text.
 *
 * HN uses a bare `<p>` as a paragraph separator (there is no closing tag), so
 * those are turned into blank lines before parsing. `DOMParser` with
 * `text/html` never runs scripts or loads resources, so this is safe for
 * untrusted input. The output is plain text and is rendered as text, never
 * as HTML.
 */
export function stripHtml(html: string): string {
    const withBreaks = html.replace(/<p\s*\/?>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n')
    const doc = new DOMParser().parseFromString(withBreaks, 'text/html')
    const text = doc.body.textContent ?? ''
    return text
        .replace(/[ \t]+/g, ' ')
        .replace(/ ?\n ?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}
