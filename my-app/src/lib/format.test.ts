import { describe, expect, it } from 'vitest'

import { absoluteDate, relativeTime, stripHtml } from './format'

const now = new Date('2026-10-30T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms)
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('relativeTime', () => {
    it.each([
        [ago(10_000), 'just now'],
        [ago(5 * MINUTE), '5 minutes ago'],
        [ago(3 * HOUR), '3 hours ago'],
        [ago(DAY), 'yesterday'],
        [ago(3 * DAY), '3 days ago'],
        [ago(14 * DAY), '2 weeks ago'],
        [ago(90 * DAY), '3 months ago'],
        [ago(800 * DAY), '2 years ago'],
    ])('formats %s as "%s"', (date, expected) => {
        expect(relativeTime(date, now)).toBe(expected)
    })
})

describe('absoluteDate', () => {
    it('formats a medium date', () => {
        expect(absoluteDate(new Date('2026-10-30T12:00:00Z'))).toBe('Oct 30, 2026')
    })
})

describe('stripHtml', () => {
    it('turns HN paragraph markers into blank lines', () => {
        expect(stripHtml('One.<p>Two.<p>Three.')).toBe('One.\n\nTwo.\n\nThree.')
    })

    it('removes tags and decodes entities', () => {
        expect(stripHtml('Know <i>Rust</i> &amp; <a href="x">Go</a> &#x2F; C')).toBe(
            'Know Rust & Go / C',
        )
    })

    it('never keeps script content as markup', () => {
        const result = stripHtml(
            '<script>alert(1)</script>Hi<img src=x onerror=alert(1)>',
        )
        expect(result).not.toContain('<')
        expect(result).toContain('Hi')
    })

    it('collapses runs of whitespace', () => {
        expect(stripHtml('a   b\n\n\n\nc')).toBe('a b\n\nc')
    })
})
