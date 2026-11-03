/**
 * Maps `items` through async `fn`, running at most `limit` calls at a time.
 * Results keep the order of `items`. Rejects as soon as any call rejects.
 *
 * The HN API has no bulk endpoint, so each job is a separate request. Capping
 * concurrency keeps the browser from opening up to 200 sockets at once.
 */
export async function mapWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    if (!Number.isInteger(limit) || limit < 1) {
        throw new RangeError(`limit must be a positive integer, got ${limit}`)
    }

    const results = new Array<R>(items.length)
    let nextIndex = 0

    // Each worker pulls the next unclaimed index until the list is exhausted.
    // JS is single-threaded, so `nextIndex++` cannot race between workers.
    async function worker(): Promise<void> {
        while (nextIndex < items.length) {
            const index = nextIndex++
            results[index] = await fn(items[index] as T, index)
        }
    }

    const workerCount = Math.min(limit, items.length)
    await Promise.all(Array.from({ length: workerCount }, worker))
    return results
}
