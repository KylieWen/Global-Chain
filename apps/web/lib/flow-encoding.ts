/**
 * Pure visual encoding for the beam flow layer.
 *
 * Amounts / quantities map to particle density and beam width through the same
 * absolute bands as the classic line-width encoding (map-presentation.ts), so
 * the two renderers stay comparable. Missing, withheld, invalid and estimated
 * records are distinguished: `unknown` never becomes a zero flow — it receives
 * a minimal baseline beam that stays visible, without a mass boost.
 */

const AMOUNT_BANDS = [0, 1e6, 1e7, 1e8, 1e9, 1e10] as const;

/** Baseline factor for records without a usable numeric mass (unknown / withheld / invalid). */
export const BASELINE_FACTOR = 0.16;

const VALID_STATUS = new Set(["observed", "estimated"]);

/** Band index 0–5 for a usable numeric mass; null when the record has no reportable value. */
export function flowMassBand(value: number | null, status: string): number | null {
  if (value === null || !Number.isFinite(value) || value < 0 || !VALID_STATUS.has(status)) return null;
  let band = 0;
  for (let index = 0; index < AMOUNT_BANDS.length; index += 1) {
    if (value >= AMOUNT_BANDS[index]) band = index;
  }
  return band;
}

/** Normalised 0–1 mass factor; missing values keep a low baseline so small flows stay visible. */
export function massFactor(band: number | null): number {
  if (band === null) return BASELINE_FACTOR;
  const ratio = Math.min(5, Math.max(0, band)) / 5;
  return 0.22 + 0.78 * ratio;
}

/** Resolve the numeric mass used for encoding, preferring the selected measure. */
export function recordMass(input: {
  value: number | null;
  valueStatus: string;
  quantity: number | null;
  quantityStatus: string;
  measure: "amount" | "quantity";
}): number | null {
  return input.measure === "quantity"
    ? flowMassBand(input.quantity, input.quantityStatus)
    : flowMassBand(input.value, input.valueStatus);
}

/** Beam width in map units; factor 0–1, multiplier from user settings. */
export function beamWidthFor(factor: number, minWidth: number, maxWidth: number, multiplier: number): number {
  const clamped = Math.min(1, Math.max(0, factor));
  const base = minWidth + clamped * (maxWidth - minWidth);
  return Math.min(maxWidth * 1.6, Math.max(minWidth * 0.7, base * multiplier));
}

export type ParticleEntry = { id: string; factor: number };

/**
 * Head speed as a one-way function of the mass factor: a 1 亿 flow drifts at
 * half speed, a 1 000 亿 flow sprints. Speed carries magnitude on top of
 * density, so a heavy lane reads as both busier and faster.
 */
export function particleSpeed(factor: number): number {
  const clamped = Math.min(1, Math.max(0, factor));
  return 0.5 + clamped * 1.35;
}

/**
 * Distribute the particle budget across flows. Square-root weighting keeps large
 * flows from drowning small ones; every visible flow keeps at least one particle.
 * The total never exceeds the configured cap.
 */
export function allocateParticles(
  entries: readonly ParticleEntry[],
  density: number,
  maxParticles: number,
  floorPerFlow = 1
): Map<string, number> {
  const result = new Map<string, number>();
  if (entries.length === 0) return result;
  const cappedDensity = Math.min(1, Math.max(0.1, density));
  // The hard cap wins over the per-flow floor: when there are more flows than
  // particles, only the strongest flows receive particles; the rest stay
  // visible through the faint guide arc / classic line instead of breaking the cap.
  const budget = Math.max(0, Math.min(maxParticles, Math.round(maxParticles * cappedDensity)));
  // Steeper than sqrt: a 10x heavier flow should visibly carry far more traffic
  // than a thin one, otherwise every lane reads as the same brightness.
  const weights = entries.map(entry => Math.pow(Math.max(0.05, entry.factor), 1.6));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const floor = entries.length <= budget
    ? Math.min(floorPerFlow, Math.max(1, Math.floor(budget / entries.length)))
    : 0;

  if (floor === 0) {
    // More flows than particles: hand out single slots by weight, strongest first.
    const ranked = entries.map((entry, index) => ({ entry, weight: weights[index] }))
      .sort((a, b) => b.weight - a.weight);
    for (let slot = 0; slot < budget; slot += 1) {
      result.set(ranked[slot].entry.id, 1);
    }
    return result;
  }

  entries.forEach((entry, index) => {
    const share = totalWeight > 0 ? weights[index] / totalWeight : 1 / entries.length;
    result.set(entry.id, Math.max(floor, Math.round(budget * share)));
  });

  // Cap the total: trim the largest pools first, never below the per-flow floor.
  let total = [...result.values()].reduce((sum, count) => sum + count, 0);
  const ordered = [...result.entries()].sort((a, b) => b[1] - a[1]);
  let cursor = 0;
  while (total > budget && ordered.length > 0) {
    const [id, count] = ordered[cursor % ordered.length];
    if (count <= floor) { cursor += 1; if (cursor >= ordered.length) break; continue; }
    result.set(id, count - 1);
    total -= 1;
    cursor += 1;
  }

  // Spread any leftover budget to the largest pools.
  total = [...result.values()].reduce((sum, count) => sum + count, 0);
  let leftover = budget - total;
  cursor = 0;
  while (leftover > 0 && ordered.length > 0) {
    const [id, count] = ordered[cursor % ordered.length];
    result.set(id, count + 1);
    leftover -= 1;
    cursor += 1;
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Adaptive degradation. Level 3 means the renderer hands the view back to the  */
/* classic static arcs; levels 0–2 tune the particle budget, glow and trail.   */
/* -------------------------------------------------------------------------- */

export type AdaptiveLevel = 0 | 1 | 2 | 3;

export type AdaptiveReason = "default" | "reduced-motion" | "low-power" | "slow-frames" | "recovery";

export type AdaptiveHint = {
  reducedMotion: boolean;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  flowCount: number;
};

export const LEVEL_PARTICLE_SCALE: readonly number[] = [1, 0.7, 0.45, 0];
export const LEVEL_GLOW_SCALE: readonly number[] = [1, 0.6, 0, 0];
export const LEVEL_TRAIL_SCALE: readonly number[] = [1, 0.8, 0.5, 0];

const SLOW_FRAME_MS = 28;
const FAST_FRAME_MS = 15;

function baselineLevel(hint: AdaptiveHint): { level: AdaptiveLevel; reason: AdaptiveReason } {
  if (hint.reducedMotion) return { level: 3, reason: "reduced-motion" };
  const lowPower = (hint.hardwareConcurrency !== null && hint.hardwareConcurrency <= 4)
    || (hint.deviceMemory !== null && hint.deviceMemory <= 4);
  if (lowPower) return { level: 1, reason: "low-power" };
  if (hint.flowCount > 140) return { level: 1, reason: "low-power" };
  return { level: 0, reason: "default" };
}

export function initialAdaptiveLevel(hint: AdaptiveHint): { level: AdaptiveLevel; reason: AdaptiveReason } {
  return baselineLevel(hint);
}

/**
 * Step the adaptive level based on a recent average frame cost. Slow frames
 * degrade one step; sustained fast frames recover one step. Reduced motion
 * stays at the static fallback regardless of frame cost.
 */
export function nextAdaptiveLevel(
  prev: AdaptiveLevel,
  avgFrameMs: number,
  hint: AdaptiveHint
): { level: AdaptiveLevel; reason: AdaptiveReason } {
  const baseline = baselineLevel(hint);
  if (hint.reducedMotion) return { level: 3, reason: "reduced-motion" };
  if (!Number.isFinite(avgFrameMs) || avgFrameMs <= 0) return { level: prev, reason: "default" };

  if (avgFrameMs >= SLOW_FRAME_MS && prev < 3) {
    return { level: (prev + 1) as AdaptiveLevel, reason: "slow-frames" };
  }
  if (avgFrameMs <= FAST_FRAME_MS && prev > baseline.level) {
    return { level: (prev - 1) as AdaptiveLevel, reason: "recovery" };
  }
  return { level: prev, reason: baseline.reason };
}
