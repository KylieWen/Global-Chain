/** Shared types for the beam flow renderers (WebGL primary, Canvas2D fallback). */

export type BeamFlowState = "active" | "muted" | "normal";

export type BeamFlow = {
  id: string;
  from: readonly [number, number];
  to: readonly [number, number];
  control: readonly [number, number];
  color: string;
  /** Normalised 0–1 mass factor; missing records keep a low baseline. */
  factor: number;
  /** Amount band 0–5 for the beam bundle width profile; null when no usable mass. */
  band: number | null;
  /** Bundle lane spread in map units, already scaled by the user beam-width multiplier. */
  width: number;
  state: BeamFlowState;
};

export type BeamDiagnostics = {
  particleCount: number;
  level: number;
  cap: number;
};

export type BeamRenderer = "webgl" | "canvas2d";
