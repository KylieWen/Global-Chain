import type { ComponentCoverageView, ProductBreakdownNode } from "@globe-chain/domain";
import type { DataMethod, FactStatus } from "@globe-chain/contracts";

/**
 * Pure, data-driven derivation of the five-level exploded-view framework from the
 * real BOM tree.
 *
 * Data limitation (confirmed in the batch-3 audit): the published breakdown only
 * carries `parentItemId` and a coarse `itemType`. The root is the finished product;
 * its direct children are first-level modules; `material` / `raw_material` are
 * materials. Assemblies and parts cannot be reliably separated for every component,
 * so deeper components are presented as a merged "部件" lane and the unresolved
 * assembly/part split is reported as an explicit gap instead of being fabricated.
 * `processStage` is never treated as an assembly level.
 */

export type ExplodedLaneId = "product" | "module" | "assembly-part" | "part" | "material";

export const EXPLODED_LANE_META: readonly { id: ExplodedLaneId; label: string; hint: string }[] = [
  { id: "product", label: "整机", hint: "最终商品" },
  { id: "module", label: "模块", hint: "整机的直接组成部分" },
  { id: "assembly-part", label: "部件", hint: "装配体与零件暂按合并层级呈现" },
  { id: "part", label: "零件", hint: "零件级拆分尚未收录" },
  { id: "material", label: "材料", hint: "原料与辅料" }
];

export type LedgerEntityRef = { readonly id: string; readonly name: string };

/** Dedupe ledger roles per item by entity id, preserving the first non-empty name. */
function dedupeLedgerEntities(entries: readonly LedgerEntityRef[]): LedgerEntityRef[] {
  const seen = new Set<string>();
  const out: LedgerEntityRef[] = [];
  for (const entry of entries) {
    if (!entry.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push({ id: entry.id, name: entry.name });
  }
  return out;
}

export type ExplodedNode = {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly itemType: string;
  readonly depth: number;
  readonly lane: ExplodedLaneId;
  readonly description: string | null;
  readonly dataStatus: FactStatus;
  readonly method: DataMethod;
  readonly isService: boolean;
  readonly children: readonly ExplodedNode[];
  readonly descendantIds: readonly string[];
  readonly hasRoute: boolean;
  readonly hasProcessChain: boolean;
  readonly hasTrade: boolean;
  readonly explorable: boolean;
  readonly processChainId: string | null;
  readonly routeNodeCount: number;
  readonly routeFlowCount: number;
  readonly ledgerEntities: readonly LedgerEntityRef[];
  readonly gapNote: string | null;
};

export type ExplodedLane = {
  readonly id: ExplodedLaneId;
  readonly label: string;
  readonly hint: string;
  readonly present: boolean;
  readonly missingNote: string | null;
  readonly nodeIds: readonly string[];
};

export type ExplodedRenderMode = "procedural-3d" | "iso-layers";

export type ExplodedModel = {
  readonly root: ExplodedNode;
  readonly nodes: readonly ExplodedNode[];
  readonly lanes: readonly ExplodedLane[];
  readonly maxDepth: number;
  readonly nodeCount: number;
  readonly renderMode: ExplodedRenderMode;
  readonly gaps: readonly string[];
  readonly serviceNodeIds: readonly string[];
  readonly moduleIds: readonly string[];
  readonly materialIds: readonly string[];
};

export type ExplodedModelInput = {
  readonly root: ProductBreakdownNode;
  readonly componentCoverage?: readonly ComponentCoverageView[];
  readonly tradeItems?: ReadonlySet<string> | readonly string[];
  readonly explorableItemIds?: readonly string[];
  readonly ledgerEntitiesByItem?: Readonly<Record<string, readonly LedgerEntityRef[]>>;
};

const MATERIAL_TYPES = new Set(["material", "raw_material"]);

function laneFor(itemType: string, depth: number): { lane: ExplodedLaneId; gapNote: string | null } {
  if (depth === 0) return { lane: "product", gapNote: null };
  if (MATERIAL_TYPES.has(itemType)) return { lane: "material", gapNote: null };
  if (depth === 1) return { lane: "module", gapNote: null };
  // Components below the first level cannot be split into assemblies vs parts
  // from the available fields; they stay in the merged parts lane with a gap note.
  return { lane: "assembly-part", gapNote: "装配体与零件层级暂不能从现有拆解数据可靠区分，本节点按合并部件呈现。" };
}

function collectDescendants(node: ProductBreakdownNode): string[] {
  const ids: string[] = [];
  const walk = (current: ProductBreakdownNode) => {
    for (const child of current.children) {
      ids.push(child.item.id);
      walk(child);
    }
  };
  walk(node);
  return ids;
}

function buildNode(
  node: ProductBreakdownNode,
  coverageById: ReadonlyMap<string, ComponentCoverageView>,
  tradeItems: ReadonlySet<string>,
  explorableIds: ReadonlySet<string>,
  ledgerByItem: Readonly<Record<string, readonly LedgerEntityRef[]>>
): ExplodedNode {
  const { item, depth } = node;
  const coverage = coverageById.get(item.id);
  const isService = item.itemType === "service";
  const { lane, gapNote } = laneFor(item.itemType, depth);
  const processChain = coverage?.processChains[0] ?? null;
  const hasRoute = coverage?.hasInspectableStory === true || explorableIds.has(item.id);
  const hasProcessChain = Boolean(processChain);
  const hasTrade = tradeItems.has(item.id);
  const children = node.children.map((child) =>
    buildNode(child, coverageById, tradeItems, explorableIds, ledgerByItem)
  );

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    itemType: item.itemType,
    depth,
    lane,
    description: item.description ?? null,
    dataStatus: item.dataStatus,
    method: item.method,
    isService,
    children,
    descendantIds: collectDescendants(node),
    hasRoute,
    hasProcessChain,
    hasTrade,
    explorable: hasRoute || hasProcessChain || hasTrade,
    processChainId: processChain?.id ?? null,
    routeNodeCount: coverage?.nodeCount ?? 0,
    routeFlowCount: coverage?.flowCount ?? 0,
    ledgerEntities: dedupeLedgerEntities(ledgerByItem[item.id] ?? []),
    gapNote
  };
}

function flatten(node: ExplodedNode, acc: ExplodedNode[]): ExplodedNode[] {
  acc.push(node);
  for (const child of node.children) flatten(child, acc);
  return acc;
}

/**
 * Procedural 3D is reserved for shallow, physically assembled products that have
 * several modules with component sub-parts; deeper material/process chains fall
 * back to the deterministic isometric layer diagram. Thresholds are data-driven
 * (depth, node count, module shape) — no product or item id is special-cased.
 */
export function chooseRenderMode(nodes: readonly ExplodedNode[], maxDepth: number, nodeCount: number): ExplodedRenderMode {
  const MAX_3D_NODES = 60;
  const MAX_3D_DEPTH = 2;
  const MIN_MODULES_WITH_COMPONENT_CHILDREN = 3;
  if (nodeCount > MAX_3D_NODES || maxDepth > MAX_3D_DEPTH) return "iso-layers";
  const root = nodes.find((node) => node.depth === 0);
  if (!root) return "iso-layers";
  const modulesWithComponentChildren = root.children.filter((mod) =>
    mod.children.some((child) => child.itemType === "component")
  ).length;
  return modulesWithComponentChildren >= MIN_MODULES_WITH_COMPONENT_CHILDREN ? "procedural-3d" : "iso-layers";
}

export function buildExplodedModel(input: ExplodedModelInput): ExplodedModel {
  const coverageById = new Map((input.componentCoverage ?? []).map((entry) => [entry.item.id, entry]));
  const tradeItems = input.tradeItems instanceof Set ? input.tradeItems : new Set(input.tradeItems ?? []);
  const explorableIds = new Set(input.explorableItemIds ?? []);
  const ledgerByItem = input.ledgerEntitiesByItem ?? {};

  const root = buildNode(input.root, coverageById, tradeItems, explorableIds, ledgerByItem);
  const nodes = flatten(root, []);
  const maxDepth = nodes.reduce((max, node) => Math.max(max, node.depth), 0);
  const serviceNodeIds = nodes.filter((node) => node.isService).map((node) => node.id);
  const moduleIds = root.children.map((child) => child.id);
  const materialIds = nodes.filter((node) => node.lane === "material").map((node) => node.id);

  const lanes: ExplodedLane[] = EXPLODED_LANE_META.map((meta) => {
    const laneNodes = nodes.filter((node) => node.lane === meta.id);
    let missingNote: string | null = null;
    if (laneNodes.length === 0) {
      missingNote = meta.id === "part"
        ? "零件级拆分尚未收录；现有拆解未区分装配体与零件。"
        : `当前商品未收录「${meta.label}」层级。`;
    }
    return {
      id: meta.id,
      label: meta.label,
      hint: meta.hint,
      present: laneNodes.length > 0,
      missingNote,
      nodeIds: laneNodes.map((node) => node.id)
    };
  });

  const gaps: string[] = [];
  if (nodes.some((node) => node.lane === "assembly-part")) {
    gaps.push("当前拆解记录只包含父子从属关系与粗粒度类型；装配体与零件暂不能可靠区分，深层部件按合并层级呈现。");
  }
  if (maxDepth > 2) {
    gaps.push("该商品为材料/工艺链条，层级按从属顺序展示；工序阶段不等同于装配层级。");
  }
  if (serviceNodeIds.length > 0) {
    gaps.push("服务/设计类条目不是物理部件，仅作为环节说明挂在所属部件下。");
  }
  const unresolvedParts = nodes.filter((node) => !node.explorable && node.depth > 0);
  if (unresolvedParts.length > 0) {
    gaps.push(`${unresolvedParts.length} 个部件尚无已发布的路线、工序或贸易记录，仅作拆解占位。`);
  }

  return {
    root,
    nodes,
    lanes,
    maxDepth,
    nodeCount: nodes.length,
    renderMode: chooseRenderMode(nodes, maxDepth, nodes.length),
    gaps,
    serviceNodeIds,
    moduleIds,
    materialIds
  };
}

/** Deterministic palette assignment: tree order maps onto the theme item palette. */
export function explodedColorIndex(nodes: readonly ExplodedNode[], id: string): number {
  const index = nodes.findIndex((node) => node.id === id);
  return index < 0 ? 0 : index;
}
