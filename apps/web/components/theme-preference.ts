"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, type StorageLike } from "../lib/theme/preference";
import { createThemeStore } from "../lib/theme/store";
import { createMediaQueryStore, type MediaQueryStore } from "../lib/theme/media-query";
import {
  parseThemeConfig,
  resolveResolvedTheme,
  resolveThemeTokens,
  type ResolvedTheme,
  type ThemeConfig,
  type ThemeMode,
  type ThemeTokens,
  type ThemeTokenOverrides
} from "../lib/theme/tokens";
import {
  mapResetPatch,
  mapTokenPatch,
  normalizeSettingsPatch,
  settingsFromMapTokens,
  flowModeFromTokenMode,
  tokenModeFromFlowMode,
  type FlowMode,
  type FlowSettings
} from "../lib/flow-config";

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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMergeRecord(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isPlainRecord(value) && isPlainRecord(out[key]) ? deepMergeRecord(out[key], value) : value;
  }
  return out;
}

/** Deep-merge a validated UI patch into the persisted partial token overrides. */
function mergeTokenPatch(current: ThemeConfig, patch: ThemeTokenOverrides): ThemeConfig {
  const baseTokens = (current.tokens ?? {}) as Record<string, unknown>;
  const mergedTokens = { ...baseTokens };
  for (const [section, sectionPatch] of Object.entries(patch)) {
    if (!isPlainRecord(sectionPatch)) {
      mergedTokens[section] = sectionPatch;
      continue;
    }
    const existing = isPlainRecord(mergedTokens[section]) ? (mergedTokens[section] as Record<string, unknown>) : {};
    mergedTokens[section] = deepMergeRecord(existing, sectionPatch);
  }
  return { ...current, tokens: mergedTokens as ThemeTokenOverrides };
}

export type ThemePreference = {
  resolved: ResolvedTheme;
  mode: ThemeMode;
  reducedMotion: boolean;
  config: ThemeConfig;
  tokens: ThemeTokens;
  flowMode: FlowMode;
  setMode: (mode: ThemeMode) => void;
  toggleResolved: () => void;
  setFlowMode: (mode: FlowMode) => void;
  updateFlowSettings: (patch: Partial<FlowSettings>) => { warnings: string[] };
  resetFlowSettings: () => void;
  exportConfig: () => string;
  importConfig: (raw: string) => { ok: boolean; warnings: string[] };
};

export function useThemePreference(): ThemePreference {
  const config = useSyncExternalStore(store.subscribe, store.snapshot, () => store.serverSnapshot);
  const systemDark = useMediaQuery(darkMedia);
  const reducedMotion = useMediaQuery(motionMedia);
  const resolved = resolveResolvedTheme(config.mode, systemDark);
  const { tokens } = resolveThemeTokens(config, systemDark);

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

  const setFlowMode = useCallback((mode: FlowMode) => {
    commitAndNotify(mergeTokenPatch(store.snapshot(), { map: { mode: tokenModeFromFlowMode(mode) } }));
  }, []);

  const updateFlowSettings = useCallback((patch: Partial<FlowSettings>) => {
    const current = settingsFromMapTokens(resolveThemeTokens(store.snapshot(), systemDark).tokens.map);
    const { settings, warnings } = normalizeSettingsPatch(current, patch);
    commitAndNotify(mergeTokenPatch(store.snapshot(), { map: mapTokenPatch(settings) }));
    return { warnings };
  }, [systemDark]);

  const resetFlowSettings = useCallback(() => {
    const snapshot = store.snapshot();
    const next: ThemeConfig = { ...snapshot };
    if (!next.tokens) {
      commitAndNotify(next);
      return;
    }
    const currentMap = resolveThemeTokens(snapshot, systemDark).tokens.map;
    const restTokens = { ...next.tokens };
    restTokens.map = mapResetPatch(currentMap);
    next.tokens = restTokens;
    commitAndNotify(next);
  }, [systemDark]);

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

  return {
    resolved,
    mode: config.mode,
    reducedMotion,
    config,
    tokens,
    flowMode: flowModeFromTokenMode(tokens.map.mode),
    setMode,
    toggleResolved,
    setFlowMode,
    updateFlowSettings,
    resetFlowSettings,
    exportConfig,
    importConfig
  };
}
