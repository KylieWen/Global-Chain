import { describe, expect, it } from "vitest";
import { readThemeConfig, writeThemeConfig, THEME_STORAGE_KEY, type StorageLike } from "../apps/web/lib/theme/preference";
import { defaultThemeConfig, serializeThemeConfig, type ThemeConfig } from "../apps/web/lib/theme/tokens";

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

describe("theme preference persistence", () => {
  it("falls back to the default dark config without a storage backend", () => {
    expect(readThemeConfig(null)).toEqual(defaultThemeConfig());
  });

  it("reads a persisted config and round-trips through write", () => {
    const storage = new MockStorage();
    const config: ThemeConfig = { version: defaultThemeConfig().version, mode: "light" };
    expect(writeThemeConfig(storage, config)).toBe(true);
    expect(readThemeConfig(storage)).toEqual(config);
  });

  it("recovers to the default config when stored JSON is corrupted", () => {
    const storage = new MockStorage();
    storage.setItem(THEME_STORAGE_KEY, "{not valid json");
    expect(readThemeConfig(storage)).toEqual(defaultThemeConfig());
  });

  it("does not throw when storage rejects writes", () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => undefined
    };
    expect(writeThemeConfig(failing, defaultThemeConfig())).toBe(false);
    expect(readThemeConfig(failing)).toEqual(defaultThemeConfig());
  });

  it("keeps partial token overrides through the persisted payload", () => {    const storage = new MockStorage();
    const config: ThemeConfig = {
      version: defaultThemeConfig().version,
      mode: "system",
      tokens: { map: { particle: { speed: 0.8 } } }
    };
    writeThemeConfig(storage, config);
    const restored = readThemeConfig(storage);
    expect(restored.mode).toBe("system");
    expect(restored.tokens?.map?.particle?.speed).toBe(0.8);
    expect(serializeThemeConfig(restored)).toBeTruthy();
  });
});
