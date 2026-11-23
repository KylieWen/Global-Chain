import { describe, expect, it } from "vitest";
import {
  flowModeFromTokenMode,
  FLOW_SETTING_RANGES,
  mapResetPatch,
  mapTokenPatch,
  normalizeSettingsPatch,
  settingsFromMapTokens,
  tokenModeFromFlowMode,
  type FlowSettings
} from "../apps/web/lib/flow-config";
import { themeTokensByScheme, type MapFlowTokens } from "../apps/web/lib/theme/tokens";

function mapTokens(): MapFlowTokens {
  return structuredClone(themeTokensByScheme.dark.map);
}

describe("flow mode mapping", () => {
  it("maps beam and classic to the reserved token modes and back", () => {
    expect(flowModeFromTokenMode("beam")).toBe("beam");
    expect(flowModeFromTokenMode("static-arc")).toBe("classic");
    expect(tokenModeFromFlowMode("beam")).toBe("beam");
    expect(tokenModeFromFlowMode("classic")).toBe("static-arc");
  });
});

describe("flow settings extraction and patch", () => {
  it("reads defaults from the resolved map tokens", () => {
    const settings = settingsFromMapTokens(mapTokens());
    expect(settings.density).toBe(FLOW_SETTING_RANGES.density.default);
    expect(settings.maxParticles).toBe(FLOW_SETTING_RANGES.maxParticles.default);
    expect(settings.glow).toBe(mapTokens().node.glow);
  });

  it("clamps out-of-range and non-finite token values to the safe ranges", () => {
    const map = mapTokens();
    map.particle.density = 9;
    map.particle.speed = -4;
    map.particle.maxParticles = NaN;
    map.node.glow = 2;
    const settings = settingsFromMapTokens(map);
    expect(settings.density).toBe(FLOW_SETTING_RANGES.density.max);
    expect(settings.speed).toBe(FLOW_SETTING_RANGES.speed.min);
    expect(settings.maxParticles).toBe(FLOW_SETTING_RANGES.maxParticles.default);
    expect(settings.glow).toBe(FLOW_SETTING_RANGES.glow.max);
  });

  it("builds a partial token patch that round-trips through extraction", () => {
    const settings: FlowSettings = { density: 0.3, speed: 1.4, beamWidth: 2.2, glow: 0.8, trail: 0.2, maxParticles: 320 };
    const patch = mapTokenPatch(settings);
    expect(patch.particle?.width).toBeCloseTo(4.4);
    const restored = settingsFromMapTokens({ ...mapTokens(), ...patch, particle: { ...mapTokens().particle, ...patch.particle }, node: { ...mapTokens().node, ...patch.node } });
    expect(restored).toEqual(settings);
  });
});

describe("settings patch validation", () => {
  it("merges a valid partial patch and keeps the other leaves", () => {
    const current = settingsFromMapTokens(mapTokens());
    const { settings, warnings } = normalizeSettingsPatch(current, { speed: 1.2, trail: 0.6 });
    expect(warnings).toEqual([]);
    expect(settings.speed).toBe(1.2);
    expect(settings.trail).toBe(0.6);
    expect(settings.density).toBe(current.density);
  });

  it("rejects unknown keys and non-finite numbers with warnings", () => {
    const current = settingsFromMapTokens(mapTokens());
    const { settings, warnings } = normalizeSettingsPatch(current, { speed: NaN, unknown: 3 });
    expect(settings.speed).toBe(current.speed);
    expect(warnings.length).toBe(2);
  });
});

describe("flow settings reset patch", () => {
  it("keeps the chosen classic mode but drops every tuning override", () => {
    const map = mapTokens();
    map.mode = "static-arc";
    map.particle.density = 0.2;
    map.particle.maxParticles = 400;
    map.node.glow = 0.9;
    map.line.opacity = 0.2;
    map.palette.itemColors = ["#111111"];
    const patch = mapResetPatch(map);
    expect(patch.mode).toBe("static-arc");
    expect(patch.particle).toBeUndefined();
    expect(patch.line).toBeUndefined();
    expect(patch.node).toBeUndefined();
    expect(patch.palette).toBeUndefined();
  });

  it("keeps beam mode and leaves only the mode leaf in the patch", () => {
    const patch = mapResetPatch(mapTokens());
    expect(patch.mode).toBe("beam");
    expect(Object.keys(patch)).toEqual(["mode"]);
  });
});
