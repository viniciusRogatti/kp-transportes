/** Limit independent requests and finish the current batch before reporting failure. */
export async function forEachInBatches<T>(items: T[], task: (item: T) => Promise<unknown>, size = 4) {
  for (let index = 0; index < items.length; index += size) {
    const results = await Promise.allSettled(items.slice(index, index + size).map(task));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) throw failed.reason;
  }
}
