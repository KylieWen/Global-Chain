import appearanceConfig from "../../../content/exploded-appearance.json";
import type { ExplodedNode } from "./exploded-model";

/**
 * Appearance mapping for the procedural exploded view.
 *
 * The real BOM still drives node count, depth, hierarchy and links; this
 * content configuration only decides how a node is drawn: its silhouette role,
 * material color group and which exploded layer band it sits in. Products and
 * nodes without an explicit entry fall back to generic role defaults derived
 * from `itemType`, so the renderer never special-cases an id in code.
 */

export type ShapeKind =
  | "frame"
  | "frame-part"
  | "glass"
  | "screen"
  | "panel"
  | "rear"
  | "bottle"
  | "bottle-cap"
  | "liquid"
  | "garment"
  | "bike"
  | "wheel"
  | "ac-unit"
  | "battery-pack"
  | "battery-cell"
  | "pcb"
  | "board-small"
  | "chip"
  | "wafer"
  | "lens"
  | "camera-bump"
  | "speaker"
  | "motor"
  | "module"
  | "sheet"
  | "wire"
  | "note"
  | "material";

export type ExplodedLayer = "front" | "mid" | "rear";

export type ResolvedRole = {
  readonly shape: ShapeKind;
  readonly material: string;
  readonly layer: ExplodedLayer;
};

type NodeRoleConfig = {
  readonly shape?: ShapeKind;
  readonly material?: string;
  readonly layer?: ExplodedLayer;
};

type ProductAppearance = {
  readonly prototype: string;
  readonly bodySize?: readonly [number, number, number];
  readonly fallbackByType: Readonly<Record<string, NodeRoleConfig>>;
  readonly nodeRoles: Readonly<Record<string, NodeRoleConfig>>;
};

type AppearanceConfigShape = {
  readonly version: number;
  readonly products: Readonly<Record<string, ProductAppearance>>;
  readonly materials: Readonly<Record<"dark" | "light", Readonly<Record<string, string>>>>;
};

const config = appearanceConfig as unknown as AppearanceConfigShape;

const GENERIC_FALLBACK: ResolvedRole = { shape: "module", material: "material", layer: "mid" };

export type Vec3 = readonly [number, number, number];

/**
 * Default footprint per visual role. These are presentation proportions only;
 * the real BOM still decides how many nodes exist and how they nest. The root
 * body uses the product `bodySize` override when present.
 */
const SHAPE_SIZE: Record<ShapeKind, Vec3> = {
  frame: [1.62, 3.15, 0.45],
  "frame-part": [1.2, 2.6, 0.18],
  glass: [1.36, 2.76, 0.06],
  screen: [1.36, 2.76, 0.09],
  panel: [1.1, 2.0, 0.08],
  rear: [1.38, 2.78, 0.1],
  bottle: [1.05, 2.3, 0.85],
  "bottle-cap": [0.65, 0.3, 0.65],
  liquid: [0.95, 1.85, 0.75],
  garment: [2.2, 1.7, 0.18],
  bike: [3.0, 1.6, 0.5],
  wheel: [0.85, 0.85, 0.22],
  "ac-unit": [2.8, 1.3, 0.55],
  "battery-pack": [1.0, 1.35, 0.15],
  "battery-cell": [0.36, 0.5, 0.12],
  pcb: [1.1, 1.2, 0.08],
  "board-small": [0.55, 0.55, 0.08],
  chip: [0.34, 0.34, 0.1],
  wafer: [0.3, 0.3, 0.06],
  lens: [0.18, 0.18, 0.09],
  "camera-bump": [0.52, 0.52, 0.14],
  speaker: [0.4, 0.2, 0.24],
  motor: [0.34, 0.34, 0.3],
  module: [0.85, 0.7, 0.35],
  sheet: [0.34, 0.24, 0.05],
  wire: [0.36, 0.12, 0.05],
  note: [0.38, 0.26, 0.04],
  material: [0.42, 0.3, 0.06]
};

/** Shapes that share the body footprint: they stack on the body axis along depth. */
const BODY_ALIGNED_SHAPES: ReadonlySet<ShapeKind> = new Set([
  "frame",
  "frame-part",
  "glass",
  "screen",
  "panel",
  "rear",
  "bottle",
  "bottle-cap",
  "liquid",
  "garment",
  "bike",
  "wheel",
  "ac-unit"
]);

export function isBodyAligned(shape: ShapeKind): boolean {
  return BODY_ALIGNED_SHAPES.has(shape);
}

/** Resolve a role's footprint: root body size first, then shape default. */
export function shapeSize(
  shape: ShapeKind,
  bodySize: readonly [number, number, number] | null,
  isRoot: boolean
): Vec3 {
  if (isRoot && bodySize) return bodySize;
  return SHAPE_SIZE[shape] ?? SHAPE_SIZE.module;
}

function productAppearance(productId: string): ProductAppearance | null {
  return config.products[productId] ?? null;
}

/** Prototype key used for the fallback glyph (bottle / garment / frame / split unit). */
export function productPrototype(productId: string): string | null {
  return productAppearance(productId)?.prototype ?? null;
}

/** Root body dimensions from content config; generic box ratio otherwise. */
export function productBodySize(productId: string): readonly [number, number, number] | null {
  return productAppearance(productId)?.bodySize ?? null;
}

function fallbackForType(itemType: string, fallbacks: Readonly<Record<string, NodeRoleConfig>>): NodeRoleConfig {
  return fallbacks[itemType] ?? {};
}

/** Resolve the visual role for a node: explicit entry first, then item-type fallback. */
export function resolveNodeRole(productId: string, node: ExplodedNode): ResolvedRole {
  const product = productAppearance(productId);
  if (!product) return GENERIC_FALLBACK;
  const explicit = product.nodeRoles[node.id] ?? {};
  const typed = fallbackForType(node.itemType, product.fallbackByType);
  return {
    shape: explicit.shape ?? typed.shape ?? GENERIC_FALLBACK.shape,
    material: explicit.material ?? typed.material ?? GENERIC_FALLBACK.material,
    layer: explicit.layer ?? typed.layer ?? GENERIC_FALLBACK.layer
  };
}

/** Material color groups for the active scheme, with a generic neutral fallback. */
export function schemeMaterials(scheme: "dark" | "light"): Readonly<Record<string, string>> {
  return config.materials[scheme] ?? config.materials.dark;
}
