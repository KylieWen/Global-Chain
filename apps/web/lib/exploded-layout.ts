import type { ExplodedModel, ExplodedNode } from "./exploded-model";

/**
 * Deterministic, data-driven layout for the exploded views. Positions derive from
 * tree depth and sibling order only; no product, item id, geometry count or color
 * is hard-coded here.
 */

export type Vec3 = readonly [number, number, number];

export type ExplodedBox = {
  readonly id: string;
  readonly parentId: string | null;
  readonly anchor: Vec3;
  readonly size: Vec3;
  readonly depth: number;
  readonly lane: string;
};

const LANE_SIZE: Record<string, Vec3> = {
  product: [2.1, 1.6, 1.3],
  module: [1.35, 1.0, 0.95],
  "assembly-part": [0.95, 0.7, 0.66],
  part: [0.76, 0.58, 0.52],
  material: [0.6, 0.45, 0.45],
  service: [0.52, 0.38, 0.38]
};

const MODULE_RADIUS = 3.3;
const CHILD_RADIUS = 1.95;

function sizeFor(node: ExplodedNode): Vec3 {
  return LANE_SIZE[node.isService ? "service" : node.lane] ?? LANE_SIZE["assembly-part"];
}

function ringAngle(index: number, total: number, offset = 0): number {
  if (total <= 1) return offset;
  return offset + ((index + 0.5) / total) * Math.PI * 2;
}

/**
 * 3D anchors before camera projection. `explosion` is 0 (assembled) to 1 (fully
 * separated); intermediate values interpolate child offsets toward the parent.
 */
export function layoutExplodedBoxes(model: ExplodedModel, explosion: number): Map<string, ExplodedBox> {
  const boxes = new Map<string, ExplodedBox>();
  const ease = Math.min(1, Math.max(0, explosion));

  const place = (node: ExplodedNode, parent: ExplodedBox | null, parentAngle: number, siblingIndex: number, siblingTotal: number): void => {
    let anchor: Vec3;
    if (!parent) {
      anchor = [0, 0, 0];
    } else {
      const angle = ringAngle(siblingIndex, siblingTotal, parentAngle);
      const radius = node.depth === 1 ? MODULE_RADIUS : CHILD_RADIUS;
      const bandY = node.lane === "material"
        ? parent.anchor[1] - 1.45
        : node.depth === 1
          ? 0.85
          : parent.anchor[1] - 0.8;
      const outward: Vec3 = [Math.cos(angle) * radius, bandY, Math.sin(angle) * radius];
      const nested: Vec3 = [
        parent.anchor[0] + outward[0] * 0.15,
        parent.anchor[1] + outward[1] * 0.2,
        parent.anchor[2] + outward[2] * 0.15
      ];
      const spread: Vec3 = [
        parent.anchor[0] + outward[0],
        parent.anchor[1] + outward[1],
        parent.anchor[2] + outward[2]
      ];
      anchor = [
        nested[0] + (spread[0] - nested[0]) * ease,
        nested[1] + (spread[1] - nested[1]) * ease,
        nested[2] + (spread[2] - nested[2]) * ease
      ];
    }
    const box: ExplodedBox = {
      id: node.id,
      parentId: parent?.id ?? null,
      anchor,
      size: sizeFor(node),
      depth: node.depth,
      lane: node.lane
    };
    boxes.set(node.id, box);

    const childAngle = parent ? Math.atan2(parent.anchor[2], parent.anchor[0]) : 0;
    node.children.forEach((child, index) => place(child, box, childAngle, index, node.children.length));
  };

  place(model.root, null, 0, 0, 1);
  return boxes;
}

export type IsoSlot = {
  readonly id: string;
  readonly parentId: string | null;
  readonly row: number;
  readonly col: number;
  readonly depth: number;
  readonly lane: string;
};

/**
 * Isometric fallback layout: one row per BOM depth, children flow horizontally
 * under their parent. Deep material/process chains keep their real order instead
 * of being forced into the five physical lanes.
 */
export function layoutIsoSlots(model: ExplodedModel): Map<string, IsoSlot> {
  const slots = new Map<string, IsoSlot>();
  const rowCursors = new Map<number, number>();

  const place = (node: ExplodedNode, parent: IsoSlot | null): void => {
    const row = node.depth;
    const col = rowCursors.get(row) ?? 0;
    rowCursors.set(row, col + 1);
    const slot: IsoSlot = { id: node.id, parentId: parent?.id ?? null, row, col, depth: node.depth, lane: node.lane };
    slots.set(node.id, slot);
    node.children.forEach((child) => place(child, slot));
  };

  place(model.root, null);
  return slots;
}
