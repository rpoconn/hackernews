import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { JobHitSchema, toJob } from '../../api/hn/schemas'
import { NOW, rawJustinTv, rawWasmer } from '../../test/fixtures'
import { JobCard } from './JobCard'

/** Validates a raw hit the way the query does, then converts it. */
const parse = (hit: unknown) => toJob(JobHitSchema.parse(hit))

describe('JobCard', () => {
    it('links the title to the external posting', () => {
        render(<JobCard job={parse(rawWasmer)} now={NOW} />)
        const link = screen.getByRole('link', { name: rawWasmer.title })
        expect(link).toHaveAttribute('href', rawWasmer.url)
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noreferrer')
    })

    it('shows company, batch, domain, poster and relative time', () => {
        render(<JobCard job={parse(rawWasmer)} now={NOW} />)
        expect(screen.getByText('Wasmer')).toBeInTheDocument()
        expect(screen.getByText('YC S19')).toBeInTheDocument()
        expect(screen.getByText('workatastartup.com')).toBeInTheDocument()
        expect(screen.getByText(/by syrusakbary/)).toBeInTheDocument()
        expect(screen.getByText('2 days ago')).toBeInTheDocument()
    })

    it('falls back to the HN discussion when there is no external URL', () => {
        render(<JobCard job={parse(rawJustinTv)} now={NOW} />)
        expect(screen.getByRole('link', { name: rawJustinTv.title })).toHaveAttribute(
            'href',
            'https://news.ycombinator.com/item?id=192327',
        )
    })

    it('renders inline posting bodies as plain text', () => {
        render(<JobCard job={parse(rawJustinTv)} now={NOW} />)
        expect(screen.getByText(/know AS3 & Rails/)).toBeInTheDocument()
        expect(document.querySelector('.job-card i')).toBeNull()
    })

    it('collapses long bodies behind a toggle', () => {
        const longText = 'word '.repeat(100)
        render(<JobCard job={parse({ ...rawJustinTv, job_text: longText })} now={NOW} />)

        const toggle = screen.getByRole('button', { name: 'Show more' })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(screen.getByText(/…$/)).toBeInTheDocument()

        fireEvent.click(toggle)
        expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute(
            'aria-expanded',
            'true',
        )
        expect(screen.queryByText(/…$/)).not.toBeInTheDocument()
    })

    it('has no toggle for short bodies', () => {
        render(<JobCard job={parse(rawJustinTv)} now={NOW} />)
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})
