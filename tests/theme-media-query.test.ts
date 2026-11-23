import { afterEach, describe, expect, it, vi } from "vitest";
import { createMediaQueryStore } from "../apps/web/lib/theme/media-query";

type ChangeListener = (event: { matches: boolean }) => void;

function installFakeWindow(initial: boolean): { setMatches: (value: boolean) => void } {
  let matches = initial;
  const listeners = new Set<ChangeListener>();
  const mql = {
    get matches() {
      return matches;
    },
    addEventListener: (_type: string, listener: ChangeListener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: ChangeListener) => {
      listeners.delete(listener);
    }
  };
  const fakeWindow = { matchMedia: vi.fn(() => mql) };
  (globalThis as Record<string, unknown>).window = fakeWindow;
  return {
    setMatches(value: boolean) {
      matches = value;
      listeners.forEach(listener => listener({ matches: value }));
    }
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe("media query boolean store", () => {
  it("returns null when window / matchMedia is unavailable", () => {
    expect(createMediaQueryStore("(prefers-color-scheme: dark)")).toBeNull();
  });

  it("exposes the initial match result as a stable boolean snapshot", () => {
    installFakeWindow(true);
    const store = createMediaQueryStore("(prefers-color-scheme: dark)");
    expect(store).not.toBeNull();
    if (!store) return;
    expect(store.getSnapshot()).toBe(true);
    expect(store.getSnapshot()).toBe(true);
  });

  it("notifies subscribers and updates the snapshot when the preference changes", () => {
    const env = installFakeWindow(false);
    const store = createMediaQueryStore("(prefers-reduced-motion: reduce)");
    expect(store).not.toBeNull();
    if (!store) return;

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    env.setMatches(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(true);

    unsubscribe();
    env.setMatches(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
