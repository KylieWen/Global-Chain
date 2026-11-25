import appearanceConfig from "../../../content/exploded-appearance.json";
import type { ExplodedNode } from "./exploded-model";

/**
 * Appearance mapping for the exploded view.
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
  frame: [1.5, 3.0, 0.4],
  "frame-part": [1.15, 2.5, 0.16],
  glass: [1.4, 2.8, 0.05],
  screen: [1.4, 2.8, 0.07],
  panel: [1.05, 1.9, 0.07],
  rear: [1.44, 2.84, 0.08],
  bottle: [1.0, 2.2, 0.8],
  "bottle-cap": [0.6, 0.28, 0.6],
  liquid: [0.9, 1.8, 0.7],
  garment: [2.2, 1.6, 0.16],
  bike: [3.0, 1.5, 0.45],
  wheel: [0.8, 0.8, 0.2],
  "ac-unit": [2.7, 1.25, 0.5],
  "battery-pack": [0.95, 1.25, 0.13],
  "battery-cell": [0.34, 0.46, 0.1],
  pcb: [1.0, 1.05, 0.07],
  "board-small": [0.5, 0.5, 0.07],
  chip: [0.3, 0.3, 0.09],
  wafer: [0.28, 0.28, 0.05],
  lens: [0.16, 0.16, 0.08],
  "camera-bump": [0.5, 0.5, 0.13],
  speaker: [0.38, 0.18, 0.2],
  motor: [0.32, 0.32, 0.28],
  module: [0.8, 0.66, 0.32],
  sheet: [0.32, 0.24, 0.05],
  wire: [0.34, 0.1, 0.05],
  note: [0.36, 0.24, 0.04],
  material: [0.34, 0.26, 0.06]
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

/** Corner radius as a fraction of the smaller footprint dimension. */
const SHAPE_RADIUS: Partial<Record<ShapeKind, number>> = {
  frame: 0.12,
  "frame-part": 0.1,
  glass: 0.12,
  screen: 0.12,
  panel: 0.1,
  rear: 0.12,
  bottle: 0.2,
  garment: 0.06,
  "ac-unit": 0.08,
  "battery-pack": 0.08,
  module: 0.06
};

export function shapeRadius(shape: ShapeKind): number {
  return SHAPE_RADIUS[shape] ?? 0.04;
}

export type PBRMaterial = {
  readonly metalness: number;
  readonly roughness: number;
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
  readonly transparent?: boolean;
  readonly opacity?: number;
};

/** Physical material response per color group; presentation only, no real data claim. */
const PBR_BY_GROUP: Readonly<Record<string, PBRMaterial>> = {
  frame: { metalness: 0.7, roughness: 0.28 },
  screen: { metalness: 0.1, roughness: 0.18, emissive: "#24406b", emissiveIntensity: 0.5 },
  rear: { metalness: 0.15, roughness: 0.75 },
  pcb: { metalness: 0.2, roughness: 0.55 },
  battery: { metalness: 0.25, roughness: 0.5 },
  chip: { metalness: 0.35, roughness: 0.38 },
  module: { metalness: 0.2, roughness: 0.55 },
  material: { metalness: 0.1, roughness: 0.7 },
  metal: { metalness: 0.85, roughness: 0.28 },
  copper: { metalness: 0.9, roughness: 0.3 },
  aluminum: { metalness: 0.9, roughness: 0.25 },
  rare: { metalness: 0.35, roughness: 0.55 },
  ceramic: { metalness: 0.05, roughness: 0.8 },
  polymer: { metalness: 0.05, roughness: 0.65 },
  "glass-mat": { metalness: 0.05, roughness: 0.12, transparent: true, opacity: 0.62 },
  carbon: { metalness: 0.1, roughness: 0.85 },
  fabric: { metalness: 0, roughness: 0.95 },
  liquid: { metalness: 0, roughness: 0.35, transparent: true, opacity: 0.85 },
  "frame-paint": { metalness: 0.3, roughness: 0.45 },
  appliance: { metalness: 0.1, roughness: 0.6 }
};

export function materialPBR(material: string): PBRMaterial {
  return PBR_BY_GROUP[material] ?? PBR_BY_GROUP.material;
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
