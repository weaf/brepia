export type InFlightRequestResult<T> = {
  promise: Promise<T>;
  reused: boolean;
};

/**
 * Deduplicate identical work while it is still in flight.
 *
 * The entry is removed as soon as the shared promise settles, so a later
 * explicit user action can start fresh work. This is intentionally an
 * in-memory concurrency guard, not a persistent cache.
 */
export function createInFlightRequestDeduper<T>() {
  const inFlight = new Map<string, Promise<T>>();

  return {
    getOrRun(key: string, task: () => Promise<T>): InFlightRequestResult<T> {
      const existing = inFlight.get(key);
      if (existing) return { promise: existing, reused: true };

      // Defer task invocation to a promise turn so the const binding is fully
      // initialized before the cleanup callback can ever reference it, even
      // when task throws synchronously.
      const promise = Promise.resolve()
        .then(task)
        .finally(() => {
          if (inFlight.get(key) === promise) inFlight.delete(key);
        });
      inFlight.set(key, promise);
      return { promise, reused: false };
    },
  };
}
