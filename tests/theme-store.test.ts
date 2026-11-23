import { describe, expect, it, vi } from "vitest";
import { createThemeStore, type ThemeStore } from "../apps/web/lib/theme/store";
import { THEME_STORAGE_KEY, type StorageLike } from "../apps/web/lib/theme/preference";
import { serializeThemeConfig, type ThemeConfig } from "../apps/web/lib/theme/tokens";

class MockStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.has(key) ? this.values.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const lightConfig: ThemeConfig = { version: 1, mode: "light" };
const darkConfig: ThemeConfig = { version: 1, mode: "dark" };

function seed(storage: StorageLike, config: ThemeConfig): void {
  storage.setItem(THEME_STORAGE_KEY, serializeThemeConfig(config));
}

describe("theme store snapshot stability", () => {
  it("returns the same snapshot reference on repeated reads with empty storage", () => {
    const store = createThemeStore(new MockStorage());
    const first = store.snapshot();
    const second = store.snapshot();
    expect(first).toBe(second);
    expect(first.mode).toBe("dark");
  });

  it("exposes a stable server snapshot constant", () => {
    const store = createThemeStore(null);
    expect(store.serverSnapshot).toBe(store.serverSnapshot);
    expect(store.serverSnapshot.mode).toBe("dark");
  });

  it("commits a new config once, keeps the following snapshot reference stable, and persists it", () => {
    const storage = new MockStorage();
    const store = createThemeStore(storage);
    const before = store.snapshot();

    store.commit(lightConfig);
    const afterFirst = store.snapshot();
    const afterSecond = store.snapshot();

    expect(afterFirst).toBe(afterSecond);
    expect(afterFirst).not.toBe(before);
    expect(afterFirst.mode).toBe("light");
    expect(storage.getItem(THEME_STORAGE_KEY)).toContain('"mode": "light"');
  });

  it("invalidates the cache after an external change and returns a fresh stable reference", () => {
    const storage = new MockStorage();
    seed(storage, lightConfig);
    const store = createThemeStore(storage);
    const before = store.snapshot();

    seed(storage, darkConfig);
    store.invalidate();
    const afterFirst = store.snapshot();
    const afterSecond = store.snapshot();

    expect(afterFirst).not.toBe(before);
    expect(afterFirst).toBe(afterSecond);
    expect(afterFirst.mode).toBe("dark");
  });

  it("notifies the external subscriber, which invalidates the cached snapshot", () => {
    const storage = new MockStorage();
    seed(storage, lightConfig);
    const listeners: Array<() => void> = [];
    const store: ThemeStore = createThemeStore(storage, listener => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    });
    const unsubscribe = store.subscribe(() => undefined);

    const before = store.snapshot();
    seed(storage, darkConfig);
    expect(listeners).toHaveLength(1);
    listeners[0]();

    const after = store.snapshot();
    expect(after).not.toBe(before);
    expect(after.mode).toBe("dark");
    unsubscribe();
  });

  it("keeps an in-memory fallback with a stable snapshot when storage rejects writes", () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => undefined
    };
    const store = createThemeStore(failing);
    store.commit(lightConfig);
    const first = store.snapshot();
    const second = store.snapshot();
    expect(first).toBe(second);
    expect(first.mode).toBe("light");
  });

  it("falls back to the default dark config when stored JSON is corrupted and stays stable", () => {
    const storage = new MockStorage();
    storage.setItem(THEME_STORAGE_KEY, "{broken");
    const store = createThemeStore(storage);
    const first = store.snapshot();
    const second = store.snapshot();
    expect(first).toBe(second);
    expect(first.mode).toBe("dark");
  });

  it("detaches the external subscriber on unsubscribe", () => {
    const storage = new MockStorage();
    const detach = vi.fn();
    const store = createThemeStore(storage, () => detach);
    const unsubscribe = store.subscribe(() => undefined);
    unsubscribe();
    expect(detach).toHaveBeenCalledTimes(1);
  });
});
