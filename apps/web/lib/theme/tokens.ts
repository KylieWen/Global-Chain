/**
 * Serializable design tokens and theme configuration for the experience layer.
 *
 * This module is pure (no DOM, no server-only imports) so it can be unit-tested
 * in a Node environment and reused by future shareable theme presets.
 *
 * Structure note: the `map` and `flow` sections are intentionally generic
 * containers, not a fixed list of color-only settings. Batch 2 will add NEXUS
 * beam parameters (particle density / speed / width, glow) and a fallback
 * classic-arc mode on top of the same validated shape; batch 3 may add layout
 * presets for exploded views. Unknown future keys are ignored with a warning
 * rather than rejected outright.
 */

export const THEME_CONFIG_VERSION = 1 as const;

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export type PaletteTokens = {
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceRaised: string;
  ink: string;
  inkSoft: string;
  muted: string;
  line: string;
  lineStrong: string;
  /** The single brand / interaction accent. Item colors are reserved for flows. */
  accent: string;
  accentSoft: string;
  accentInk: string;
  success: string;
  warning: string;
  danger: string;
  mapOcean: string;
  mapLand: string;
  mapLandLimited: string;
  mapGraticule: string;
  /** Country / province outline and graticule stroke. */
  mapBorder: string;
};

export type TypeTokens = {
  familyBase: string;
  /** Monospace family used for years, amounts and codes. */
  familyMono: string;
  scale: { base: number; h1: number; h2: number; h3: number; small: number };
  lineHeight: { tight: number; base: number; relaxed: number };
};

export type SpacingTokens = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  section: number;
};

export type MotionTokens = {
  durationFast: number;
  durationBase: number;
  durationSlow: number;
  easing: string;
  /** Policy for users who prefer reduced motion; runtime honors the OS setting. */
  reducedMotion: "respect-preference";
};

/**
 * Reserved, serializable map / flow configuration.
 * `mode` selects the renderer: `beam` is the NEXUS-style particle flow;
 * `static-arc` is the classic arrow / static arc fallback. `particle` and
 * `node` drive the tuning panel and persist through the same import/export
 * path as the rest of the theme config.
 */
export type MapFlowTokens = {
  mode: "static-arc" | "beam";
  line: {
    minWidth: number;
    maxWidth: number;
    opacity: number;
    activeOpacity: number;
    mutedOpacity: number;
    dashArray: string | null;
  };
  particle: {
    density: number;
    speed: number;
    width: number;
    maxParticles: number;
    /** Trail persistence per particle, 0–1. */
    trail: number;
  };
  node: {
    radius: number;
    glow: number;
  };
  palette: {
    itemColors: string[];
    /** Regional supply-stage colors for the China atlas (material / component / manufacturing / market). */
    stageColors: Record<"material" | "component" | "manufacturing" | "market", string>;
  };
};

export type ThemeTokens = {
  scheme: "dark" | "light";
  palette: PaletteTokens;
  type: TypeTokens;
  spacing: SpacingTokens;
  motion: MotionTokens;
  map: MapFlowTokens;
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type ThemeTokenOverrides = DeepPartial<ThemeTokens>;

/** Persisted, shareable theme configuration. Tokens may be partially overridden. */
export type ThemeConfig = {
  version: typeof THEME_CONFIG_VERSION;
  mode: ThemeMode;
  tokens?: ThemeTokenOverrides;
};

const darkTokens: ThemeTokens = {
  scheme: "dark",
  palette: {
    background: "#0b1220",
    backgroundElevated: "#0f1728",
    surface: "#131d31",
    surfaceRaised: "#1a263d",
    ink: "#e8eef6",
    inkSoft: "#b6c2d4",
    muted: "#8494ab",
    line: "#26344a",
    lineStrong: "#384961",
    accent: "#5ec8b4",
    accentSoft: "rgb(94 200 180 / 14%)",
    accentInk: "#0b1220",
    success: "#68e4c1",
    warning: "#ffbb66",
    danger: "#ff9a93",
    mapOcean: "#0d1626",
    mapLand: "#1c2a3f",
    mapLandLimited: "#162233",
    mapGraticule: "#2e4059",
    mapBorder: "#384961"
  },
  type: {
    familyBase: '"Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
    familyMono: '"SF Mono", "JetBrains Mono", "Consolas", "Roboto Mono", monospace',
    scale: { base: 1, h1: 2.6, h2: 1.6, h3: 1.15, small: 0.78 },
    lineHeight: { tight: 1.1, base: 1.7, relaxed: 1.9 }
  },
  spacing: { xs: 0.25, sm: 0.5, md: 1, lg: 1.5, xl: 2.5, section: 4 },
  motion: {
    durationFast: 160,
    durationBase: 240,
    durationSlow: 400,
    easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
    reducedMotion: "respect-preference"
  },
  map: {
    mode: "beam",
    line: {
      minWidth: 1,
      maxWidth: 6.4,
      opacity: 0.65,
      activeOpacity: 1,
      mutedOpacity: 0.1,
      dashArray: "4 5"
    },
    particle: { density: 0.9, speed: 0.55, width: 2.3, maxParticles: 360, trail: 0.42 },
    node: { radius: 5, glow: 0.5 },
    palette: {
      itemColors: ["#68e4c1", "#ffbb66", "#86baff", "#f3a8db", "#cfe381", "#ff9a93", "#c9b4ff", "#83dce9"],
      stageColors: { material: "#f2ca7a", component: "#86baff", manufacturing: "#77e0c5", market: "#e4a5d9" }
    }
  }
};

const lightTokens: ThemeTokens = {
  scheme: "light",
  palette: {
    background: "#f4f7fb",
    backgroundElevated: "#ffffff",
    surface: "#ffffff",
    surfaceRaised: "#f7f9fc",
    ink: "#17233b",
    inkSoft: "#536078",
    muted: "#7c879c",
    line: "#dce3ed",
    lineStrong: "#7589a3",
    accent: "#0b8f88",
    accentSoft: "#e6f7f4",
    accentInk: "#ffffff",
    success: "#0b8f88",
    warning: "#c76b24",
    danger: "#b94c51",
    mapOcean: "#eef3f8",
    mapLand: "#dfe8f1",
    mapLandLimited: "#e9eef4",
    mapGraticule: "#c7d1df",
    mapBorder: "#c7d1df"
  },
  type: {
    familyBase: '"Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
    familyMono: '"SF Mono", "JetBrains Mono", "Consolas", "Roboto Mono", monospace',
    scale: { base: 1, h1: 2.6, h2: 1.6, h3: 1.15, small: 0.78 },
    lineHeight: { tight: 1.1, base: 1.7, relaxed: 1.9 }
  },
  spacing: { xs: 0.25, sm: 0.5, md: 1, lg: 1.5, xl: 2.5, section: 4 },
  motion: {
    durationFast: 160,
    durationBase: 240,
    durationSlow: 400,
    easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
    reducedMotion: "respect-preference"
  },
  map: {
    mode: "beam",
    line: {
      minWidth: 1,
      maxWidth: 6.4,
      opacity: 0.7,
      activeOpacity: 1,
      mutedOpacity: 0.12,
      dashArray: "4 5"
    },
    particle: { density: 0.9, speed: 0.55, width: 2.3, maxParticles: 360, trail: 0.38 },
    node: { radius: 5, glow: 0.4 },
    palette: {
      itemColors: ["#2f9e83", "#c76b24", "#2f65d5", "#b05596", "#7a9a2e", "#b94c51", "#6c55b8", "#2b8fa6"],
      stageColors: { material: "#c76b24", component: "#2f65d5", manufacturing: "#2f9e83", market: "#b05596" }
    }
  }
};

export const themeTokensByScheme: Readonly<Record<ResolvedTheme, ThemeTokens>> = {
  dark: darkTokens,
  light: lightTokens
};

const COLOR_PATTERN = /^(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|(?:rgb|rgba|hsl|hsla)\(\s*[\d.%/\s,()-]+\))$/;
const PALETTE_KEYS = new Set(Object.keys(darkTokens.palette));

function isValidScalar(base: unknown, value: unknown, path: string): boolean {
  if (typeof base === "string") {
    if (typeof value !== "string" || value.length === 0 || value.length > 160) return false;
    if (PALETTE_KEYS.has(path.split(".").pop() ?? "")) return COLOR_PATTERN.test(value);
    return true;
  }
  if (typeof base === "number") return typeof value === "number" && Number.isFinite(value);
  if (typeof base === "boolean") return typeof value === "boolean";
  return false;
}

function mergeTokens<T>(base: T, overrides: unknown, path: string, warnings: string[]): T {
  if (overrides === null || typeof overrides !== "object" || Array.isArray(base) !== Array.isArray(overrides)) {
    if (overrides !== undefined) warnings.push(`忽略无效主题配置段：${path}`);
    return base;
  }
  if (Array.isArray(base)) {
    const list = overrides as unknown[];
    const itemType = typeof base[0];
    if (!list.every(item => typeof item === itemType)) {
      warnings.push(`忽略无效主题配置数组：${path}`);
      return base;
    }
    return list as T;
  }
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, override] of Object.entries(overrides as Record<string, unknown>)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (!(key in (base as Record<string, unknown>))) {
      warnings.push(`忽略未知主题配置项：${nextPath}`);
      continue;
    }
    const baseValue = (base as Record<string, unknown>)[key];
    if (baseValue !== null && typeof baseValue === "object" && !Array.isArray(baseValue)) {
      result[key] = mergeTokens(baseValue, override, nextPath, warnings);
    } else if (isValidScalar(baseValue, override, nextPath)) {
      result[key] = override;
    } else {
      warnings.push(`忽略无效主题配置项：${nextPath}`);
    }
  }
  return result as T;
}

/** Deep-merge validated overrides onto the base scheme tokens; invalid values fall back to the base. */
export function applyTokenOverrides(base: ThemeTokens, overrides: ThemeTokenOverrides | undefined): { tokens: ThemeTokens; warnings: string[] } {
  const warnings: string[] = [];
  if (!overrides) return { tokens: base, warnings };
  const tokens = mergeTokens(base, overrides, "", warnings);
  return { tokens, warnings };
}

export function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light" || value === "system";
}

export function resolveResolvedTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return systemDark ? "dark" : "light";
}

/** Parse stored / imported JSON into a validated ThemeConfig; never throws on malformed input. */
export function parseThemeConfig(input: unknown): { config: ThemeConfig; warnings: string[] } {
  const warnings: string[] = [];
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    warnings.push("主题配置格式无效，已使用默认深色主题");
    return { config: defaultThemeConfig(), warnings };
  }
  const raw = input as Record<string, unknown>;
  const mode = isValidThemeMode(raw.mode) ? raw.mode : defaultThemeConfig().mode;
  if (!isValidThemeMode(raw.mode)) warnings.push("主题模式无效，已使用默认深色主题");
  let tokens: ThemeTokenOverrides | undefined;
  if (raw.tokens !== undefined) {
    if (raw.tokens !== null && typeof raw.tokens === "object" && !Array.isArray(raw.tokens)) {
      const { tokens: merged, warnings: mergeWarnings } = applyTokenOverrides(darkTokens, raw.tokens as ThemeTokenOverrides);
      warnings.push(...mergeWarnings);
      // Keep only the overridden leaves so the exported config stays a partial patch.
      tokens = diffTokens(darkTokens, merged);
    } else {
      warnings.push("忽略无效的主题令牌覆盖段");
    }
  }
  return { config: { version: THEME_CONFIG_VERSION, mode, tokens }, warnings };
}

function diffTokens(base: ThemeTokens, resolved: ThemeTokens): ThemeTokenOverrides {
  const walk = (baseValue: unknown, resolvedValue: unknown): unknown => {
    if (Array.isArray(baseValue) || Array.isArray(resolvedValue)) {
      return JSON.stringify(baseValue) === JSON.stringify(resolvedValue) ? undefined : resolvedValue;
    }
    if (baseValue && typeof baseValue === "object" && resolvedValue && typeof resolvedValue === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(resolvedValue as Record<string, unknown>)) {
        const child = walk((baseValue as Record<string, unknown>)[key], (resolvedValue as Record<string, unknown>)[key]);
        if (child !== undefined) out[key] = child;
      }
      return Object.keys(out).length ? out : undefined;
    }
    return JSON.stringify(baseValue) === JSON.stringify(resolvedValue) ? undefined : resolvedValue;
  };
  return (walk(base, resolved) ?? {}) as ThemeTokenOverrides;
}

export function defaultThemeConfig(): ThemeConfig {
  return { version: THEME_CONFIG_VERSION, mode: "dark" };
}

/** Resolve the final tokens for the active scheme, applying validated partial overrides. */
export function resolveThemeTokens(config: ThemeConfig, systemDark: boolean): { resolved: ResolvedTheme; tokens: ThemeTokens; warnings: string[] } {
  const resolved = resolveResolvedTheme(config.mode, systemDark);
  const { tokens, warnings } = applyTokenOverrides(themeTokensByScheme[resolved], config.tokens);
  return { resolved, tokens, warnings };
}

export function serializeThemeConfig(config: ThemeConfig): string {
  return JSON.stringify(config, null, 2);
}
