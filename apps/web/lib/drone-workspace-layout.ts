/**
 * Deterministic physical layout for the generic camera-drone workstation.
 *
 * This module is presentation-only: the real 16-node BOM, its hierarchy, links
 * and data status still come from `exploded-model`. The mapping below decides
 * where each generic part sits on the rebuilt Mini-style quadcopter (Y up, XZ
 * body plane), how far it travels when the assembly explodes, and which generic
 * geometry builder draws it. It does not add a priced part, an external model
 * or a fabricated origin/material fact.
 */

export type DronePartKind =
  | "hull"
  | "shell"
  | "board"
  | "chip"
  | "sensor"
  | "esc"
  | "arm"
  | "gimbal-bracket"
  | "pod"
  | "lens"
  | "axis-arm"
  | "gimbal-motor"
  | "remote"
  | "remote-board"
  | "antenna"
  | "battery-pack";

export type Vec3 = readonly [number, number, number];

export type DroneSlot = {
  readonly nodeId: string;
  readonly kind: DronePartKind;
  /** Assembled rest position in the drone body coordinate frame. */
  readonly home: Vec3;
  /** Exploded destination position (absolute, not an offset). */
  readonly spread: Vec3;
  /** Assembled arm tip (arm slots only); local beam endpoint relative to root. */
  readonly tip?: Vec3;
  /** Diagonal arm index 0..3; only set for the arm assembly node. */
  readonly armIndex?: number;
  readonly labelSide: "top" | "left" | "right" | "bottom";
};

/** Four diagonals in the XZ plane: [x, z], front = +Z. */
export const DRONE_ARM_DIRS: readonly Vec3[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1]
];

const ARM_ROOT_X = 0.18;
const ARM_ROOT_Z = 0.24;
const ARM_TIP_X = 0.66;
const ARM_TIP_Z = 0.6;
const ARM_SPREAD_X = 1.0;
const ARM_SPREAD_Z = 0.88;

function armSlot(index: number): DroneSlot {
  const [sx, , sz] = DRONE_ARM_DIRS[index];
  return {
    nodeId: "drone-arm",
    kind: "arm",
    home: [sx * ARM_ROOT_X, 0.14, sz * ARM_ROOT_Z],
    spread: [sx * ARM_SPREAD_X, 0.14, sz * ARM_SPREAD_Z],
    tip: [sx * ARM_TIP_X, 0.14, sz * ARM_TIP_Z],
    armIndex: index,
    labelSide: sx > 0 ? "right" : "left"
  };
}

/**
 * Fixed slot table keyed by node id. Every published drone node must have an
 * entry; the stage falls back to a centered chip for any missing id instead of
 * inventing a BOM part.
 */
const SLOTS: Record<string, Omit<DroneSlot, "nodeId">> = {
  "generic-camera-drone": {
    kind: "hull",
    home: [0, 0.12, 0],
    spread: [0, 0.12, 0],
    labelSide: "bottom"
  },
  "drone-airframe": {
    kind: "shell",
    home: [0, 0.18, 0],
    spread: [0, 0.55, 0],
    labelSide: "top"
  },
  "drone-core-board": {
    kind: "board",
    home: [0, 0.02, -0.04],
    spread: [0, -0.32, -0.18],
    labelSide: "bottom"
  },
  "drone-vision": {
    kind: "sensor",
    home: [0, 0.02, 0.24],
    spread: [0.14, -0.08, 0.55],
    labelSide: "top"
  },
  "drone-positioning-imu": {
    kind: "chip",
    home: [-0.12, 0.02, -0.06],
    spread: [-0.34, 0.08, -0.08],
    labelSide: "left"
  },
  "drone-esc": {
    kind: "esc",
    home: [0.12, 0.02, -0.06],
    spread: [0.38, -0.2, -0.08],
    labelSide: "right"
  },
  "drone-gimbal": {
    kind: "gimbal-bracket",
    home: [0, -0.04, 0.42],
    spread: [0, -0.14, 0.78],
    labelSide: "bottom"
  },
  "drone-gimbal-assembly": {
    kind: "pod",
    home: [0, -0.12, 0.55],
    spread: [0, -0.22, 0.92],
    labelSide: "bottom"
  },
  "drone-gimbal-camera": {
    kind: "lens",
    home: [0, -0.12, 0.66],
    spread: [0, -0.26, 1.06],
    labelSide: "bottom"
  },
  "drone-gimbal-axis-arm": {
    kind: "axis-arm",
    home: [0.09, -0.04, 0.5],
    spread: [0.26, -0.12, 0.8],
    labelSide: "right"
  },
  "drone-gimbal-motor": {
    kind: "gimbal-motor",
    home: [-0.09, -0.04, 0.5],
    spread: [-0.26, -0.12, 0.8],
    labelSide: "left"
  },
  "drone-remote": {
    kind: "remote",
    home: [-0.86, 0.02, -0.4],
    spread: [-0.95, 0.0, -0.45],
    labelSide: "left"
  },
  "drone-remote-core-board": {
    kind: "remote-board",
    home: [-0.86, 0.08, -0.4],
    spread: [-0.98, 0.12, -0.4],
    labelSide: "left"
  },
  "drone-remote-antenna": {
    kind: "antenna",
    home: [-0.78, 0.14, -0.4],
    spread: [-0.9, 0.22, -0.44],
    labelSide: "left"
  },
  "drone-remote-battery": {
    kind: "battery-pack",
    home: [-0.94, 0.0, -0.4],
    spread: [-1.0, -0.06, -0.48],
    labelSide: "left"
  }
};

/** Resolve the slot for a node; arm node expands into four corner slots. */
export function droneSlotsForNode(nodeId: string): DroneSlot[] {
  if (nodeId === "drone-arm") {
    return [armSlot(0), armSlot(1), armSlot(2), armSlot(3)];
  }
  const entry = SLOTS[nodeId];
  if (!entry) return [];
  return [{ nodeId, ...entry }];
}

/** All slots that should exist for the published 16-node drone BOM. */
export function droneAllSlots(): DroneSlot[] {
  const ids = Object.keys(SLOTS);
  return ids.flatMap((id) => droneSlotsForNode(id)).concat(
    [0, 1, 2, 3].map((index) => armSlot(index))
  );
}

/** Interpolate between assembled home and exploded spread with an eased factor. */
export function slotPosition(slot: DroneSlot, explosion: number): Vec3 {
  const ease = Math.min(1, Math.max(0, explosion));
  const [hx, hy, hz] = slot.home;
  const [sx, sy, sz] = slot.spread;
  return [hx + (sx - hx) * ease, hy + (sy - hy) * ease, hz + (sz - hz) * ease];
}
