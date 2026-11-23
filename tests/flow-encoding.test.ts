import { describe, expect, it } from "vitest";
import {
  allocateParticles,
  BASELINE_FACTOR,
  beamWidthFor,
  flowMassBand,
  initialAdaptiveLevel,
  LEVEL_GLOW_SCALE,
  LEVEL_PARTICLE_SCALE,
  massFactor,
  nextAdaptiveLevel,
  recordMass,
  type AdaptiveHint
} from "../apps/web/lib/flow-encoding";

describe("flow mass encoding", () => {
  it("returns null for unknown, withheld, invalid and non-finite amounts", () => {
    for (const status of ["unknown", "withheld", "invalid"]) expect(flowMassBand(1e9, status)).toBeNull();
    for (const value of [null, NaN, Infinity, -1]) expect(flowMassBand(value, "observed")).toBeNull();
    expect(flowMassBand(0, "observed")).toBe(0);
    expect(flowMassBand(1e8, "estimated")).toBe(3);
  });

  it("places amounts on the same absolute bands as the classic line width", () => {
    expect(flowMassBand(999_999, "observed")).toBe(0);
    expect(flowMassBand(1e6, "observed")).toBe(1);
    expect(flowMassBand(1e7, "observed")).toBe(2);
    expect(flowMassBand(1e10, "observed")).toBe(5);
    expect(flowMassBand(1e12, "observed")).toBe(5);
  });

  it("keeps missing records on a visible baseline instead of zero", () => {
    expect(massFactor(null)).toBe(BASELINE_FACTOR);
    expect(massFactor(5)).toBeGreaterThan(massFactor(0));
    expect(massFactor(0)).toBeGreaterThan(BASELINE_FACTOR);
  });

  it("prefers the selected measure when resolving record mass", () => {
    const base = { value: 1e9, valueStatus: "observed", quantity: null, quantityStatus: "unknown" };
    expect(recordMass({ ...base, measure: "amount" })).toBe(4);
    expect(recordMass({ ...base, measure: "quantity" })).toBeNull();
  });

  it("maps factor to beam width between min and max, scaled by the user multiplier", () => {
    expect(beamWidthFor(0, 1.2, 5.2, 1)).toBeCloseTo(1.2);
    expect(beamWidthFor(1, 1.2, 5.2, 1)).toBeCloseTo(5.2);
    expect(beamWidthFor(0.5, 1.2, 5.2, 2)).toBeCloseTo((1.2 + 0.5 * 4) * 2);
    expect(beamWidthFor(-2, 1.2, 5.2, 1)).toBeCloseTo(1.2);
  });
});

describe("particle allocation", () => {
  it("keeps every visible flow above the floor and the total under the cap", () => {
    const entries = [
      { id: "a", factor: 1 }, { id: "b", factor: 0.3 }, { id: "c", factor: BASELINE_FACTOR }
    ];
    const counts = allocateParticles(entries, 1, 120);
    expect([...counts.values()].every(count => count >= 1)).toBe(true);
    expect([...counts.values()].reduce((sum, count) => sum + count, 0)).toBeLessThanOrEqual(120);
    expect(counts.get("a")).toBeGreaterThan(counts.get("c")!);
  });

  it("scales the budget by density and respects a single-flow entry", () => {
    const full = allocateParticles([{ id: "a", factor: 0.8 }], 1, 200);
    const sparse = allocateParticles([{ id: "a", factor: 0.8 }], 0.2, 200);
    expect(full.get("a")).toBe(200);
    expect(sparse.get("a")).toBeLessThan(full.get("a")!);
    expect(allocateParticles([], 1, 200).size).toBe(0);
  });

  it("caps the total even when every flow asks for its floor", () => {
    const entries = Array.from({ length: 60 }, (_, index) => ({ id: String(index), factor: 0.2 }));
    const counts = allocateParticles(entries, 1, 120);
    expect([...counts.values()].reduce((sum, count) => sum + count, 0)).toBeLessThanOrEqual(120);
  });

  it("never breaks the hard cap when flows outnumber particles; weaker flows get zero", () => {
    const entries = Array.from({ length: 60 }, (_, index) => ({ id: String(index), factor: index / 60 }));
    const counts = allocateParticles(entries, 1, 20);
    const perFlow = entries.map(entry => counts.get(entry.id) ?? 0);
    const total = perFlow.reduce((sum, count) => sum + count, 0);
    expect(total).toBeLessThanOrEqual(20);
    expect(perFlow.filter(count => count === 0).length).toBeGreaterThan(0);
    expect(counts.get("59")).toBe(1);
    expect(counts.get("0") ?? 0).toBe(0);
  });

  it("keeps the total at or below a one-particle cap; weak flows stay on the guide arc", () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({ id: String(index), factor: index / 12 }));
    const counts = allocateParticles(entries, 1, 1);
    const perFlow = entries.map(entry => counts.get(entry.id) ?? 0);
    expect(perFlow.reduce((sum, count) => sum + count, 0)).toBeLessThanOrEqual(1);
    expect(counts.get("11")).toBe(1);
    expect(perFlow.slice(0, 11).every(count => count === 0)).toBe(true);
  });

  it("returns an empty allocation when the hard cap is zero", () => {
    const entries = Array.from({ length: 8 }, (_, index) => ({ id: String(index), factor: 0.4 }));
    const counts = allocateParticles(entries, 1, 0);
    expect(counts.size).toBe(0);
    expect([...counts.values()].reduce((sum, count) => sum + count, 0)).toBe(0);
  });

  it("honours density below one without exceeding the cap", () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({ id: String(index), factor: 0.5 }));
    const counts = allocateParticles(entries, 0.25, 200);
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    expect(total).toBeLessThanOrEqual(200);
    expect(total).toBeLessThan(200);
  });
});

describe("adaptive degradation", () => {
  const hint: AdaptiveHint = { reducedMotion: false, hardwareConcurrency: 8, deviceMemory: 8, flowCount: 20 };

  it("forces the static fallback under reduced motion", () => {
    const reduced: AdaptiveHint = { ...hint, reducedMotion: true };
    expect(initialAdaptiveLevel(reduced).level).toBe(3);
    expect(nextAdaptiveLevel(0, 5, reduced).level).toBe(3);
  });

  it("starts at a reduced level on low-power devices or very many flows", () => {
    expect(initialAdaptiveLevel({ ...hint, hardwareConcurrency: 2 }).level).toBe(1);
    expect(initialAdaptiveLevel({ ...hint, deviceMemory: 3 }).level).toBe(1);
    expect(initialAdaptiveLevel({ ...hint, flowCount: 160 }).level).toBe(1);
    expect(initialAdaptiveLevel(hint).level).toBe(0);
  });

  it("degrades on slow frames and recovers on sustained fast frames", () => {
    const slow = nextAdaptiveLevel(0, 32, hint);
    expect(slow.level).toBe(1);
    expect(slow.reason).toBe("slow-frames");
    const recovered = nextAdaptiveLevel(1, 10, hint);
    expect(recovered.level).toBe(0);
    expect(recovered.reason).toBe("recovery");
  });

  it("never climbs above level 3 and keeps the particle scale tables in range", () => {
    expect(nextAdaptiveLevel(3, 32, hint).level).toBe(3);
    expect(LEVEL_PARTICLE_SCALE).toHaveLength(4);
    expect(LEVEL_GLOW_SCALE).toHaveLength(4);
    expect(LEVEL_PARTICLE_SCALE[3]).toBe(0);
  });
});
