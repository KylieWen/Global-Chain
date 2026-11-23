import { describe, expect, it } from "vitest";
import {
  applyTokenOverrides,
  defaultThemeConfig,
  parseThemeConfig,
  resolveResolvedTheme,
  resolveThemeTokens,
  serializeThemeConfig,
  themeTokensByScheme,
  THEME_CONFIG_VERSION,
  type ThemeConfig
} from "../apps/web/lib/theme/tokens";

describe("theme tokens", () => {
  it("keeps both schemes JSON serializable with reserved map/flow sections", () => {
    for (const scheme of ["dark", "light"] as const) {
      const tokens = themeTokensByScheme[scheme];
      const restored = JSON.parse(JSON.stringify(tokens)) as typeof tokens;
      expect(restored.palette.background).toBe(tokens.palette.background);
      expect(restored.map.particle.maxParticles).toBe(tokens.map.particle.maxParticles);
      expect(restored.map.line.dashArray).toBe(tokens.map.line.dashArray);
      expect(restored.motion.durationBase).toBe(tokens.motion.durationBase);
    }
  });

  it("resolves system mode against the OS color-scheme preference", () => {
    expect(resolveResolvedTheme("system", true)).toBe("dark");
    expect(resolveResolvedTheme("system", false)).toBe("light");
    expect(resolveResolvedTheme("dark", false)).toBe("dark");
    expect(resolveResolvedTheme("light", true)).toBe("light");
  });

  it("falls back to the default dark config when input is malformed", () => {
    for (const bad of [null, undefined, "not-json", [], 42, true]) {
      const { config, warnings } = parseThemeConfig(bad);
      expect(config).toEqual(defaultThemeConfig());
      expect(warnings.length).toBeGreaterThan(0);
    }
  });

  it("falls back to the default dark mode and warns on an invalid mode", () => {
    const { config, warnings } = parseThemeConfig({
      version: THEME_CONFIG_VERSION,
      mode: "sepia",
      tokens: { palette: { accent: "#0b8f88" }, unknownSection: { x: 1 } }
    });
    expect(config.mode).toBe("dark");
    expect(config.tokens?.palette?.accent).toBe("#0b8f88");
    expect(warnings.some(warning => warning.includes("默认深色"))).toBe(true);
    expect(warnings.some(warning => warning.includes("unknownSection"))).toBe(true);
  });

  it("falls back to the default dark mode and warns when mode is missing", () => {
    for (const input of [{}, { version: THEME_CONFIG_VERSION }, { version: THEME_CONFIG_VERSION, mode: null }]) {
      const { config, warnings } = parseThemeConfig(input);
      expect(config.mode).toBe("dark");
      expect(warnings.some(warning => warning.includes("默认深色"))).toBe(true);
    }
  });

  it("rejects non-color palette strings and non-finite numbers, keeping the base value", () => {
    const { tokens, warnings } = applyTokenOverrides(themeTokensByScheme.dark, {
      palette: { accent: "not a color" },
      map: { particle: { speed: "fast" } },
      spacing: { md: NaN }
    });
    expect(tokens.palette.accent).toBe(themeTokensByScheme.dark.palette.accent);
    expect(tokens.map.particle.speed).toBe(themeTokensByScheme.dark.map.particle.speed);
    expect(tokens.spacing.md).toBe(themeTokensByScheme.dark.spacing.md);
    expect(warnings.length).toBe(3);
  });

  it("applies validated overrides on the resolved scheme", () => {
    const config: ThemeConfig = {
      version: THEME_CONFIG_VERSION,
      mode: "light",
      tokens: { palette: { accent: "#123456" } }
    };
    const { resolved, tokens } = resolveThemeTokens(config, true);
    expect(resolved).toBe("light");
    expect(tokens.palette.accent).toBe("#123456");
    expect(tokens.palette.background).toBe(themeTokensByScheme.light.palette.background);
  });

  it("round-trips a config through serialize and parse", () => {
    const config: ThemeConfig = {
      version: THEME_CONFIG_VERSION,
      mode: "dark",
      tokens: { map: { line: { maxWidth: 6 } } }
    };
    const { config: restored } = parseThemeConfig(JSON.parse(serializeThemeConfig(config)));
    expect(restored).toEqual(config);
  });
});
