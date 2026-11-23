"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, type StorageLike } from "../lib/theme/preference";
import { createThemeStore } from "../lib/theme/store";
import { createMediaQueryStore, type MediaQueryStore } from "../lib/theme/media-query";
import {
  parseThemeConfig,
  resolveResolvedTheme,
  type ResolvedTheme,
  type ThemeConfig,
  type ThemeMode
} from "../lib/theme/tokens";

const changeEvent = "global-chain:theme-change";

/**
 * Resolve the localStorage backend without an unguarded property read.
 * Restricted browsers (blocked cookies, sandboxed iframe) can throw a
 * SecurityError on `window.localStorage`; in that case we pass `null` and
 * keep the session-only in-memory fallback instead of crashing the module.
 */
function resolveStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const store = createThemeStore(resolveStorage(), listener => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(changeEvent, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener("storage", onStorage);
  };
});

const darkMedia = createMediaQueryStore("(prefers-color-scheme: dark)");
const motionMedia = createMediaQueryStore("(prefers-reduced-motion: reduce)");

const noopSubscribe = () => () => undefined;
const falseSnapshot = () => false;

function useMediaQuery(media: MediaQueryStore | null): boolean {
  return useSyncExternalStore(
    media ? media.subscribe : noopSubscribe,
    media ? media.getSnapshot : falseSnapshot,
    falseSnapshot
  );
}

function commitAndNotify(next: ThemeConfig): void {
  store.commit(next);
  window.dispatchEvent(new Event(changeEvent));
}

export type ThemePreference = {
  resolved: ResolvedTheme;
  mode: ThemeMode;
  reducedMotion: boolean;
  config: ThemeConfig;
  setMode: (mode: ThemeMode) => void;
  toggleResolved: () => void;
  exportConfig: () => string;
  importConfig: (raw: string) => { ok: boolean; warnings: string[] };
};

export function useThemePreference(): ThemePreference {
  const config = useSyncExternalStore(store.subscribe, store.snapshot, () => store.serverSnapshot);
  const systemDark = useMediaQuery(darkMedia);
  const reducedMotion = useMediaQuery(motionMedia);
  const resolved = resolveResolvedTheme(config.mode, systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  }, [resolved]);

  const setMode = useCallback((mode: ThemeMode) => {
    commitAndNotify({ ...store.snapshot(), mode });
  }, []);

  const toggleResolved = useCallback(() => {
    const current = resolveResolvedTheme(config.mode, systemDark);
    commitAndNotify({ ...config, mode: current === "dark" ? "light" : "dark" });
  }, [config, systemDark]);

  const exportConfig = useCallback(() => JSON.stringify(config, null, 2), [config]);

  const importConfig = useCallback((raw: string): { ok: boolean; warnings: string[] } => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, warnings: ["主题配置不是有效的 JSON"] };
    }
    const { config: next, warnings } = parseThemeConfig(parsed);
    commitAndNotify(next);
    return { ok: true, warnings };
  }, []);

  return { resolved, mode: config.mode, reducedMotion, config, setMode, toggleResolved, exportConfig, importConfig };
}
