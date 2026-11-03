import { describe, expect, it, vi } from 'vitest'

import { createLogger } from './logger'

describe('createLogger', () => {
    it('prefixes messages with the scope', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        createLogger('test', 'debug').warn('hello', { a: 1 })
        expect(warn).toHaveBeenCalledWith('[test] hello', { a: 1 })
    })

    it('drops messages below the minimum level', () => {
        const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const log = createLogger('test', 'error')
        log.debug('ignored')
        log.error('kept')
        expect(debug).not.toHaveBeenCalled()
        expect(error).toHaveBeenCalledTimes(1)
    })
})
