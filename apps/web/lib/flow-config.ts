/**
 * Pure flow-settings layer on top of the serializable theme `tokens.map`
 * contract (theme/tokens.ts).
 *
 * The world-map beam / classic mode and its tuning parameters are persisted as
 * part of the theme config (`tokens.map.mode / particle / node / line`), so the
 * same import / export path, validation and storage-fallback rules apply. This
 * module only maps between the UI-facing `FlowSettings` view model and the
 * token shape, clamps sliders to safe ranges, and builds shareable patches.
 *
 * It stays DOM-free so it can be unit-tested in Node.
 */

import type { MapFlowTokens, ThemeTokenOverrides } from "./theme/tokens";

export type FlowMode = "beam" | "classic";

/** Token mode values: `static-arc` is the classic arrow / static arc fallback. */
export const TOKEN_MODE_BY_FLOW_MODE: Record<FlowMode, MapFlowTokens["mode"]> = {
  beam: "beam",
  classic: "static-arc"
};

export const FLOW_MODE_BY_TOKEN_MODE: Record<MapFlowTokens["mode"], FlowMode> = {
  beam: "beam",
  "static-arc": "classic"
};

export type FlowSettings = {
  /** Particle-count multiplier, 0.1–1. */
  density: number;
  /** Travel speed multiplier along the arc, 0.1–2. */
  speed: number;
  /** Beam width multiplier, 0.6–3. */
  beamWidth: number;
  /** Node / beam glow strength, 0–1. */
  glow: number;
  /** Trail persistence (segment length), 0–1. */
  trail: number;
  /** Hard cap on live particles, 40–600. */
  maxParticles: number;
};

export const FLOW_SETTING_RANGES = {
  density: { min: 0.1, max: 1, default: 1 },
  speed: { min: 0.1, max: 2, default: 0.55 },
  beamWidth: { min: 0.6, max: 3, default: 1.15 },
  glow: { min: 0, max: 1, default: 0.65 },
  trail: { min: 0, max: 1, default: 0.62 },
  maxParticles: { min: 40, max: 600, default: 600 }
} as const;

/**
 * Beam-layer bundle silhouette width (full width, CSS px) per amount band
 * 0–5. Adjacent bands keep a ≥1.6 visual width ratio and the weakest bundle
 * stays ≥3px equivalent. This profile applies to the particle beam renderer
 * (WebGL primary + Canvas2D fallback) only; the classic arrow line widths
 * are a separate contract locked by map-presentation tests and are unchanged.
 */
export const BUNDLE_BAND_FULL_CSS_PX: readonly number[] = [3, 4.8, 7.7, 12.3, 19.7, 31.5];

export const FLOW_MODES: readonly FlowMode[] = ["beam", "classic"];

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Read the UI-facing settings from resolved map tokens, clamping to safe ranges. */
export function settingsFromMapTokens(map: MapFlowTokens): FlowSettings {
  return {
    density: clampNumber(map.particle.density, FLOW_SETTING_RANGES.density.min, FLOW_SETTING_RANGES.density.max, FLOW_SETTING_RANGES.density.default),
    speed: clampNumber(map.particle.speed, FLOW_SETTING_RANGES.speed.min, FLOW_SETTING_RANGES.speed.max, FLOW_SETTING_RANGES.speed.default),
    beamWidth: clampNumber(map.particle.width / 2, FLOW_SETTING_RANGES.beamWidth.min, FLOW_SETTING_RANGES.beamWidth.max, FLOW_SETTING_RANGES.beamWidth.default),
    glow: clampNumber(map.node.glow, FLOW_SETTING_RANGES.glow.min, FLOW_SETTING_RANGES.glow.max, FLOW_SETTING_RANGES.glow.default),
    trail: clampNumber(map.particle.trail, FLOW_SETTING_RANGES.trail.min, FLOW_SETTING_RANGES.trail.max, FLOW_SETTING_RANGES.trail.default),
    maxParticles: Math.round(clampNumber(map.particle.maxParticles, FLOW_SETTING_RANGES.maxParticles.min, FLOW_SETTING_RANGES.maxParticles.max, FLOW_SETTING_RANGES.maxParticles.default))
  };
}

/** Build a validated partial token patch from UI settings for the theme config. */
export function mapTokenPatch(settings: FlowSettings): NonNullable<ThemeTokenOverrides["map"]> {
  return {
    particle: {
      density: settings.density,
      speed: settings.speed,
      width: settings.beamWidth * 2,
      maxParticles: settings.maxParticles,
      trail: settings.trail
    },
    node: { glow: settings.glow }
  };
}

export function flowModeFromTokenMode(mode: MapFlowTokens["mode"]): FlowMode {
  return FLOW_MODE_BY_TOKEN_MODE[mode] ?? "beam";
}

export function tokenModeFromFlowMode(mode: FlowMode): MapFlowTokens["mode"] {
  return TOKEN_MODE_BY_FLOW_MODE[mode];
}

/**
 * Reset patch for the map section: keep the user's chosen render mode and drop
 * every tuning override (particle / line / node / palette) so the scheme
 * defaults come back. Reset must never force the mode back to its default.
 */
export function mapResetPatch(currentMap: MapFlowTokens): NonNullable<ThemeTokenOverrides["map"]> {
  return { mode: currentMap.mode };
}

/** Validate a partial settings patch; invalid leaves fall back to the current value. */
export function normalizeSettingsPatch(current: FlowSettings, patch: Partial<FlowSettings>): { settings: FlowSettings; warnings: string[] } {
  const warnings: string[] = [];
  const next: FlowSettings = { ...current };
  for (const [key, raw] of Object.entries(patch) as [keyof FlowSettings, number][]) {
    const range = FLOW_SETTING_RANGES[key];
    if (!range) {
      warnings.push(`忽略未知流动参数：${key}`);
      continue;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      next[key] = clampNumber(raw, range.min, range.max, range.default);
    } else {
      warnings.push(`忽略无效流动参数：${key}`);
    }
  }
  return { settings: next, warnings };
}
