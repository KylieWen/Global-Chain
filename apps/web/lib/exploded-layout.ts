import type { ExplodedModel, ExplodedNode } from "./exploded-model";
import { isBodyAligned, productBodySize, resolveNodeRole, shapeSize, type ExplodedLayer, type Vec3 } from "./exploded-appearance";

/**
 * Deterministic, data-driven layout for the exploded views. Positions derive from
 * tree depth, sibling order and the content appearance config only; no product,
 * item id, geometry count or color is hard-coded here.
 */

export type ExplodedBox = {
  readonly id: string;
  readonly parentId: string | null;
  anchor: [number, number, number];
  readonly size: Vec3;
  readonly depth: number;
  readonly lane: string;
  readonly layer: ExplodedLayer;
};

const INNER_X_GAP = 0.62;
const INNER_Z = 0.18;
const CHILD_RADIUS = 0.3;
const MATERIAL_X_GAP = 0.34;
const MATERIAL_Y = 0.6;

// Layer bands separate front glass, mid internals and rear cover along depth,
// so the exploded stack reads as a product manual rather than a scatter of boxes.
const LAYER_Z: Record<ExplodedLayer, number> = {
  front: 0.55,
  mid: 0,
  rear: -0.55
};

// Diagonal spread per band: each layer steps up and to the right of the one in
// front, like a product-manual exploded view. Values are fractions of body size
// applied against the root body footprint, kept generic for any product.
const LAYER_RANK: Record<ExplodedLayer, number> = { front: 0, mid: 1, rear: 2 };
const DIAG_X = 0.13;
const DIAG_Y = 0.2;

function ringAngle(index: number, total: number, offset = 0): number {
  if (total <= 1) return offset;
  return offset + ((index + 0.5) / total) * Math.PI * 2;
}

/**
 * 3D anchors before camera projection. `explosion` is 0 (assembled) to 1 (fully
 * separated); intermediate values interpolate child offsets toward the parent.
 * `productId` is optional so the pure layout stays usable without appearance data.
 */
export function layoutExplodedBoxes(
  model: ExplodedModel,
  explosion: number,
  productId?: string
): Map<string, ExplodedBox> {
  const boxes = new Map<string, ExplodedBox>();
  const ease = Math.min(1, Math.max(0, explosion));
  const bodySize = productId ? productBodySize(productId) : null;

  const place = (
    node: ExplodedNode,
    parent: ExplodedBox | null,
    parentAngle: number,
    siblingIndex: number,
    siblingTotal: number
  ): void => {
    const role = productId ? resolveNodeRole(productId, node) : null;
    const layer: ExplodedLayer = role?.layer ?? "mid";
    let anchor: [number, number, number];

    const aligned = role ? isBodyAligned(role.shape) : false;

    if (!parent) {
      anchor = [0, 0, 0];
    } else if (aligned) {
      // Body-footprint layers (front glass, screen, rear cover) fan along a gentle
      // up-right diagonal plus the depth axis, so each band reads as a separate
      // sheet in a product-manual exploded view.
      const rank = LAYER_RANK[layer];
      const diagX = rank * DIAG_X * ease;
      const diagY = -rank * DIAG_Y * ease;
      const spreadZ = node.depth === 1
        ? LAYER_Z[layer] * ease
        : parent.anchor[2] + 0.35 * ease;
      const nested: Vec3 = [
        parent.anchor[0] * 0.94,
        parent.anchor[1] * 0.94,
        parent.anchor[2]
      ];
      const spread: Vec3 = [
        parent.anchor[0] * 0.94 + diagX,
        parent.anchor[1] * 0.94 + diagY,
        spreadZ
      ];
      anchor = [
        nested[0] + (spread[0] - nested[0]) * ease,
        nested[1] + (spread[1] - nested[1]) * ease,
        nested[2] + (spread[2] - nested[2]) * ease
      ];
    } else if (node.depth === 1) {
      // Internal modules flank the body in two sides of a tidy row, lowered
      // slightly so at least half of each battery / board / module stays visible
      // beside the frame instead of being hidden behind the front panel.
      const spreadX = (siblingIndex - (siblingTotal - 1) / 2) * INNER_X_GAP;
      const spreadZ = -INNER_Z + LAYER_Z[layer] * 0.35 * ease;
      const spreadY = -0.12 * ease;
      const nested: Vec3 = [
        parent.anchor[0] + spreadX * 0.16,
        parent.anchor[1] + spreadY * 0.2,
        parent.anchor[2] + spreadZ * 0.16
      ];
      const spread: Vec3 = [
        parent.anchor[0] + spreadX,
        parent.anchor[1] + spreadY,
        parent.anchor[2] + spreadZ
      ];
      anchor = [
        nested[0] + (spread[0] - nested[0]) * ease,
        nested[1] + (spread[1] - nested[1]) * ease,
        nested[2] + (spread[2] - nested[2]) * ease
      ];
    } else if (node.lane === "material") {
      // Material inputs gather in one tidy row below their parent instead of
      // scattering as loose slabs around the body.
      const spreadX = (siblingIndex - (siblingTotal - 1) / 2) * MATERIAL_X_GAP;
      const spreadY = parent.anchor[1] - MATERIAL_Y;
      const nested: Vec3 = [
        parent.anchor[0] + spreadX * 0.16,
        parent.anchor[1] + (spreadY - parent.anchor[1]) * 0.2,
        parent.anchor[2] - 0.12 * ease
      ];
      const spread: Vec3 = [parent.anchor[0] + spreadX, spreadY, parent.anchor[2] - 0.12];
      anchor = [
        nested[0] + (spread[0] - nested[0]) * ease,
        nested[1] + (spread[1] - nested[1]) * ease,
        nested[2] + (spread[2] - nested[2]) * ease
      ];
    } else {
      const angle = ringAngle(siblingIndex, siblingTotal, parentAngle);
      const radius = CHILD_RADIUS;
      const bandY = parent.anchor[1] - 0.3;
      const outward: Vec3 = [Math.cos(angle) * radius, bandY, Math.sin(angle) * radius * 0.6];
      const nested: Vec3 = [
        parent.anchor[0] + outward[0] * 0.16,
        parent.anchor[1] + outward[1] * 0.2,
        parent.anchor[2] + outward[2] * 0.16
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
      size: shapeSize(role?.shape ?? "module", bodySize, node.depth === 0),
      depth: node.depth,
      lane: node.lane,
      layer
    };
    boxes.set(node.id, box);

    const childAngle = parent ? Math.atan2(parent.anchor[2], parent.anchor[0]) : 0;
    node.children.forEach((child, index) => place(child, box, childAngle, index, node.children.length));
  };

  place(model.root, null, 0, 0, 1);

  // Material inputs gather in one compact wrapped grid beside the body (right
  // side), outside the body fit bounding box, so they never shrink the main
  // device. The dashed parent link still explains where each material feeds in.
  const materialBoxes = [...boxes.values()].filter((box) => box.lane === "material");
  const MATERIAL_COLS = 3;
  const MATERIAL_GAP_X = 0.34;
  const MATERIAL_GAP_Y = 0.3;
  const MATERIAL_X0 = 1.9;
  const MATERIAL_Y0 = 0.7;
  materialBoxes.forEach((box, index) => {
    const col = index % MATERIAL_COLS;
    const row = Math.floor(index / MATERIAL_COLS);
    box.anchor = [
      MATERIAL_X0 + (col - (MATERIAL_COLS - 1) / 2) * MATERIAL_GAP_X,
      MATERIAL_Y0 - row * MATERIAL_GAP_Y,
      -0.1
    ];
  });

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
