/**
 * Boolean media-query store for `useSyncExternalStore`.
 *
 * The persisted config store caches an object reference; these snapshots are
 * primitive booleans, which compare by value. The store still caches the latest
 * `matches` result and notifies listeners on `change`, so OS color-scheme and
 * reduced-motion preference changes actually re-render the hook consumer.
 *
 * On the server, or when `matchMedia` is unavailable / throws, the store
 * returns `null`; the hook then falls back to a stable `false` snapshot.
 */
export type MediaQueryStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => boolean;
};

export function createMediaQueryStore(query: string): MediaQueryStore | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;

  let queryList: MediaQueryList | null = null;
  let cached = false;
  let loaded = false;

  function resolve(): MediaQueryList | null {
    if (queryList) return queryList;
    try {
      queryList = window.matchMedia(query);
    } catch {
      queryList = null;
    }
    return queryList;
  }

  function getSnapshot(): boolean {
    const list = resolve();
    if (!list) return false;
    if (!loaded) {
      loaded = true;
      cached = list.matches;
    }
    return cached;
  }

  function subscribe(listener: () => void): () => void {
    const list = resolve();
    if (!list) return () => undefined;
    const onChange = (event: MediaQueryListEvent) => {
      cached = event.matches;
      loaded = true;
      listener();
    };
    list.addEventListener("change", onChange);
    return () => {
      list.removeEventListener("change", onChange);
    };
  }

  return { subscribe, getSnapshot };
}
