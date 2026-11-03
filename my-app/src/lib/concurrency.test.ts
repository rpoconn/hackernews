import { describe, expect, it } from 'vitest'

import { mapWithConcurrency } from './concurrency'

const tick = () => new Promise((resolve) => setTimeout(resolve, 1))

describe('mapWithConcurrency', () => {
    it('preserves input order even when calls finish out of order', async () => {
        const result = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
            await new Promise((resolve) => setTimeout(resolve, ms))
            return ms * 2
        })
        expect(result).toEqual([60, 20, 40])
    })

    it('respects the concurrency limit', async () => {
        let inFlight = 0
        let peak = 0
        await mapWithConcurrency(
            Array.from({ length: 20 }, (_, i) => i),
            4,
            async () => {
                inFlight++
                peak = Math.max(peak, inFlight)
                await tick()
                inFlight--
            },
        )
        expect(peak).toBe(4)
    })

    it('handles an empty list', async () => {
        await expect(mapWithConcurrency([], 5, async () => 1)).resolves.toEqual([])
    })

    it('rejects when any call rejects', async () => {
        await expect(
            mapWithConcurrency([1, 2, 3], 2, async (n) => {
                if (n === 2) throw new Error('boom')
                return n
            }),
        ).rejects.toThrow('boom')
    })

    it('rejects an invalid limit', async () => {
        await expect(mapWithConcurrency([1], 0, async (n) => n)).rejects.toThrow(
            RangeError,
        )
    })
})
