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

const ARM_ROOT_X = 0.125;
const ARM_ROOT_Z = 0.16;
const ARM_TIP_X = 0.46;
const ARM_TIP_Z = 0.365;
const ARM_SPREAD_X = 0.36;
const ARM_SPREAD_Z = 0.28;

function armSlot(index: number): DroneSlot {
  const [sx, , sz] = DRONE_ARM_DIRS[index];
  return {
    nodeId: "drone-arm",
    kind: "arm",
    home: [sx * ARM_ROOT_X, 0.02, sz * ARM_ROOT_Z],
    spread: [sx * ARM_SPREAD_X, 0.17, sz * ARM_SPREAD_Z],
    tip: [sx * ARM_TIP_X, 0.02, sz * ARM_TIP_Z],
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
    home: [0, 0, 0],
    spread: [0, 0, 0],
    labelSide: "bottom"
  },
  "drone-airframe": {
    kind: "shell",
    home: [0, 0, 0],
    spread: [0, 0.36, 0],
    labelSide: "top"
  },
  "drone-core-board": {
    kind: "board",
    home: [0, 0.002, -0.06],
    spread: [0, -0.14, -0.1],
    labelSide: "bottom"
  },
  "drone-vision": {
    kind: "sensor",
    home: [0, 0.006, 0.17],
    spread: [0.13, -0.12, 0.42],
    labelSide: "top"
  },
  "drone-positioning-imu": {
    kind: "chip",
    home: [-0.07, 0.004, -0.08],
    spread: [-0.2, 0.02, -0.1],
    labelSide: "left"
  },
  "drone-esc": {
    kind: "esc",
    home: [0.075, 0.002, -0.07],
    spread: [0.2, -0.1, -0.06],
    labelSide: "right"
  },
  "drone-gimbal": {
    kind: "gimbal-bracket",
    home: [0, -0.026, 0.15],
    spread: [0, -0.14, 0.2],
    labelSide: "bottom"
  },
  "drone-gimbal-assembly": {
    kind: "pod",
    home: [0, -0.078, 0.175],
    spread: [0, -0.24, 0.32],
    labelSide: "bottom"
  },
  "drone-gimbal-camera": {
    kind: "lens",
    home: [0, -0.082, 0.228],
    spread: [0, -0.24, 0.44],
    labelSide: "bottom"
  },
  "drone-gimbal-axis-arm": {
    kind: "axis-arm",
    home: [0.075, -0.036, 0.155],
    spread: [0.17, -0.2, 0.28],
    labelSide: "right"
  },
  "drone-gimbal-motor": {
    kind: "gimbal-motor",
    home: [-0.075, -0.036, 0.155],
    spread: [-0.17, -0.2, 0.28],
    labelSide: "left"
  },
  "drone-remote": {
    kind: "remote",
    home: [-0.72, 0.02, -0.33],
    spread: [-0.56, 0.0, -0.3],
    labelSide: "left"
  },
  "drone-remote-core-board": {
    kind: "remote-board",
    home: [-0.72, 0.072, -0.33],
    spread: [-0.6, 0.1, -0.26],
    labelSide: "left"
  },
  "drone-remote-antenna": {
    kind: "antenna",
    home: [-0.66, 0.128, -0.33],
    spread: [-0.56, 0.2, -0.3],
    labelSide: "left"
  },
  "drone-remote-battery": {
    kind: "battery-pack",
    home: [-0.78, 0.0, -0.33],
    spread: [-0.64, -0.05, -0.34],
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
