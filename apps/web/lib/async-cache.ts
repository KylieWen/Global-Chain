/** Bounded process-local cache: concurrent readers share work, failed loads can retry. */
export function createAsyncCache<T>(capacity: number) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Cache capacity must be positive");
  const entries = new Map<string, Promise<T>>();
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const existing = entries.get(key);
      if (existing) {
        entries.delete(key);
        entries.set(key, existing);
        return existing;
      }
      const pending = Promise.resolve().then(load).catch((error: unknown) => {
        if (entries.get(key) === pending) entries.delete(key);
        throw error;
      });
      entries.set(key, pending);
      while (entries.size > capacity) entries.delete(entries.keys().next().value!);
      return pending;
    },
    get size() { return entries.size; }
  };
}
