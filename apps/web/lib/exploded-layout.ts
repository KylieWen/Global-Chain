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

// Shell layers separate along the body depth axis (Z) at an even spacing, so the
// exploded stack reads as a product manual rather than a scatter of boxes.
const LAYER_Z: Record<ExplodedLayer, number> = {
  front: 1.35,
  mid: 0,
  rear: -1.35
};

const MODULE_FLANK_GAP = 0.52;
const MODULE_ROW_GAP = 0.42;
const CHILD_RADIUS = 0.3;
const MATERIAL_COLS = 3;
const MATERIAL_GAP_X = 0.3;
const MATERIAL_GAP_Y = 0.26;
const MATERIAL_X0 = 1.12;
const MATERIAL_Y0 = 0.55;

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
  const bodyWidth = bodySize?.[0] ?? 1.5;

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
      // Body-footprint layers (front glass, screen, rear cover) stack along the
      // depth axis at an even interval; no lateral diagonal drift.
      const spreadZ = node.depth === 1
        ? LAYER_Z[layer] * ease
        : parent.anchor[2] + LAYER_Z[layer] * 0.4 * ease;
      const nested: Vec3 = [parent.anchor[0], parent.anchor[1], parent.anchor[2]];
      const spread: Vec3 = [parent.anchor[0], parent.anchor[1], spreadZ];
      anchor = [
        nested[0] + (spread[0] - nested[0]) * ease,
        nested[1] + (spread[1] - nested[1]) * ease,
        nested[2] + (spread[2] - nested[2]) * ease
      ];
    } else if (node.depth === 1) {
      // Internal modules flank the body in two ordered columns, staggered by
      // rows so each part stays visible beside the frame.
      const side = siblingIndex % 2 === 0 ? -1 : 1;
      const row = Math.floor(siblingIndex / 2);
      const spreadX = side * (bodyWidth / 2 + MODULE_FLANK_GAP + 0.08 * row);
      const spreadY = (row - (siblingTotal - 1) / 4) * MODULE_ROW_GAP;
      const spreadZ = -0.12;
      const nested: Vec3 = [
        parent.anchor[0] + spreadX * 0.16,
        parent.anchor[1] + spreadY * 0.2,
        parent.anchor[2] + spreadZ * 0.16
      ];
      const spread: Vec3 = [parent.anchor[0] + spreadX, parent.anchor[1] + spreadY, parent.anchor[2] + spreadZ];
      anchor = [
        nested[0] + (spread[0] - nested[0]) * ease,
        nested[1] + (spread[1] - nested[1]) * ease,
        nested[2] + (spread[2] - nested[2]) * ease
      ];
    } else if (node.lane === "material") {
      // Material inputs gather in a compact wrapped grid; the viewer repositions
      // the cluster below the body when the canvas is narrow.
      const spreadX = (siblingIndex - (siblingTotal - 1) / 2) * MATERIAL_GAP_X;
      const spreadY = parent.anchor[1] - 0.55;
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
      const bandY = parent.anchor[1] - 0.28;
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

  // Material inputs gather in one compact wrapped grid beside the body, outside
  // the body fit bounding box on wide canvases. The dashed parent link still
  // explains where each material feeds in.
  const materialBoxes = [...boxes.values()].filter((box) => box.lane === "material");
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
