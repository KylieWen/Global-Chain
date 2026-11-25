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
  /** Bundle width in map units, already scaled by the user beam-width multiplier. */
  width: number;
  state: BeamFlowState;
};

export type BeamDiagnostics = {
  particleCount: number;
  level: number;
  cap: number;
};

export type BeamRenderer = "webgl" | "canvas2d";
