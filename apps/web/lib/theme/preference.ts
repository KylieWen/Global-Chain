import {
  defaultThemeConfig,
  parseThemeConfig,
  serializeThemeConfig,
  type ThemeConfig
} from "./tokens";

export const THEME_STORAGE_KEY = "globechain-theme";

/** Minimal Storage surface so the logic can be tested against an in-memory mock. */
export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/**
 * Read the persisted theme config. Any unavailable / corrupted storage falls
 * back to the default dark theme instead of throwing.
 */
export function readThemeConfig(storage: StorageLike | null): ThemeConfig {
  if (!storage) return defaultThemeConfig();
  let raw: string | null = null;
  try {
    raw = storage.getItem(THEME_STORAGE_KEY);
  } catch {
    return defaultThemeConfig();
  }
  if (!raw) return defaultThemeConfig();
  try {
    return parseThemeConfig(JSON.parse(raw)).config;
  } catch {
    return defaultThemeConfig();
  }
}

/** Persist the config; returns false when storage is unavailable (e.g. restricted browser). */
export function writeThemeConfig(storage: StorageLike | null, config: ThemeConfig): boolean {
  if (!storage) return false;
  try {
    storage.setItem(THEME_STORAGE_KEY, serializeThemeConfig(config));
    return true;
  } catch {
    return false;
  }
}
