import { defaultThemeConfig, type ThemeConfig } from "./tokens";
import { readThemeConfig, writeThemeConfig, type StorageLike } from "./preference";

/**
 * Pure, cache-backed theme store for `useSyncExternalStore`.
 *
 * React requires getSnapshot / getServerSnapshot to return a cached reference:
 * a fresh object on every call triggers an infinite rerender (#185). The store
 * keeps one cached config, returns the same reference until `commit` or
 * `invalidate` changes the underlying value, and exposes a stable server
 * default constant.
 */
export type ThemeStore = {
  snapshot: () => ThemeConfig;
  subscribe: (listener: () => void) => () => void;
  commit: (next: ThemeConfig) => void;
  invalidate: () => void;
  serverSnapshot: ThemeConfig;
};

export function createThemeStore(
  storage: StorageLike | null,
  externalSubscribe?: (listener: () => void) => () => void
): ThemeStore {
  const serverSnapshot = defaultThemeConfig();
  let cached: ThemeConfig = serverSnapshot;
  let loaded = false;
  let memoryOnly = false;

  function read(): ThemeConfig {
    if (loaded) return cached;
    loaded = true;
    if (!memoryOnly) cached = readThemeConfig(storage);
    return cached;
  }

  function snapshot(): ThemeConfig {
    return read();
  }

  function invalidate(): void {
    loaded = false;
  }

  function commit(next: ThemeConfig): void {
    cached = next;
    loaded = true;
    memoryOnly = !writeThemeConfig(storage, next);
  }

  function subscribe(listener: () => void): () => void {
    const onExternalChange = () => {
      invalidate();
      listener();
    };
    const detachExternal = externalSubscribe?.(onExternalChange);
    return () => detachExternal?.();
  }

  return { snapshot, subscribe, commit, invalidate, serverSnapshot };
}
