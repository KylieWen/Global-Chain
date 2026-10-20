import type { ProductBreakdownNode, ProductQueryService, ResolvedEvidenceView, SupplyChainStoryView } from "@globe-chain/domain";
import type { MapFilters } from "./paths";

type Source = NonNullable<ResolvedEvidenceView["source"]>;

export type MapCountry = {
  id: string;
  name: string;
  m49: string | null;
  roles: readonly string[];
  hasTradeLedger: boolean;
  hasTradeRecords: boolean;
  hasRouteNodes: boolean;
};

export type MapLine = {
  id: string;
  kind: "trade" | "supply-chain";
  fromCountryId: string;
  toCountryId: string;
  fromM49: string;
  toM49: string;
  itemName: string;
  stageLabel: string | null;
  reporterName: string | null;
  reporterId: string | null;
  direction: "import" | "export" | null;
  periodLabel: string;
  value: number | null;
  currency: string | null;
  valueDataStatus: string;
  quantity: number | null;
  unit: string | null;
  quantityDataStatus: string;
  method: string;
  datasetVersion: string;
  contentVersion: string | null;
  classification: string | null;
  evidenceLabel: string;
  evidenceDescription: string;
  notes: string | null;
  sources: readonly Source[];
  fromNodeId: string | null;
  toNodeId: string | null;
};

export type MapNode = {
  id: string;
  countryId: string;
  label: string;
  itemName: string;
  stageLabel: string;
  periodLabel: string;
  evidenceLabel: string;
};

export function mapItemOptions(node: ProductBreakdownNode): { id: string; name: string; depth: number }[] {
  return [{ id: node.item.id, name: node.item.name, depth: node.depth }, ...node.children.flatMap(mapItemOptions)];
}

function findItem(node: ProductBreakdownNode, id: string): ProductBreakdownNode | null {
  if (node.item.id === id) return node;
  for (const child of node.children) {
    const found = findItem(child, id);
    if (found) return found;
  }
  return null;
}

/** Walk upstream and downstream separately so a shared assembly node cannot pull in unrelated component inputs. */
export function mapStoryWithContext(story: SupplyChainStoryView, breakdown: ProductBreakdownNode, focus?: string): SupplyChainStoryView {
  if (!focus || focus === breakdown.item.id) return story;
  const focusedItem = findItem(breakdown, focus);
  if (!focusedItem) return { ...story, nodes: [], flows: [] };
  const itemIds = new Set(mapItemOptions(focusedItem).map(item => item.id));
  const seeds = story.nodes.filter(view => view.item && itemIds.has(view.item.id)).map(view => view.node.id);
  const selectedNodes = new Set(seeds);
  const selectedFlows = new Set<string>();
  for (const direction of ["upstream", "downstream"] as const) {
    const visited = new Set(seeds);
    const queue = [...seeds];
    while (queue.length) {
      const id = queue.shift()!;
      for (const view of story.flows) {
        const from = view.from.node?.node.id ?? view.from.referenceId;
        const to = view.to.node?.node.id ?? view.to.referenceId;
        if ((direction === "downstream" ? from : to) !== id) continue;
        selectedFlows.add(view.flow.id);
        const next = direction === "downstream" ? to : from;
        selectedNodes.add(next);
        if (!visited.has(next)) { visited.add(next); queue.push(next); }
      }
    }
  }
  return { ...story, nodes: story.nodes.filter(view => selectedNodes.has(view.node.id)), flows: story.flows.filter(view => selectedFlows.has(view.flow.id)) };
}

/** Build a map only from resolved domain queries; statistical and curated lines never share a layer. */
export function createMapView(queries: ProductQueryService, filters: MapFilters & { product: string }) {
  const overview = queries.getProductOverview(filters.product);
  const breakdown = queries.getProductBreakdown(filters.product);
  if (!overview || !breakdown) return null;
  const items = mapItemOptions(breakdown);
  const focus = filters.focus || undefined;
  if (focus && !items.some(item => item.id === focus)) return null;
  const layer = filters.layer ?? "supply-chain";
  const allBaseStory = queries.getSupplyChainStory(filters.product);
  const baseStory = allBaseStory ? mapStoryWithContext(allBaseStory, breakdown, focus) : null;
  const baseNetwork = queries.getTradeNetwork(filters.product, { itemId: focus ?? filters.product, direction: filters.direction });
  const years = [...new Set(layer === "trade"
    ? baseNetwork?.observations.map(view => view.observation.period.label) ?? []
    : [...(baseStory?.nodes.map(view => view.period.label) ?? []), ...(baseStory?.flows.map(view => view.flow.period.label) ?? [])])].sort().reverse();
  const allStory = queries.getSupplyChainStory(filters.product, { label: filters.year });
  const story = allStory ? mapStoryWithContext(allStory, breakdown, focus) : null;
  const network = queries.getTradeNetwork(filters.product, { itemId: focus ?? filters.product, label: filters.year, direction: filters.direction });
  const tradeLines: MapLine[] = network?.observations.flatMap(view => {
    const { observation: record, reporter, partner } = view;
    if (!reporter?.m49 || !partner?.m49) return [];
    const from = record.direction === "export" ? reporter : partner;
    const to = record.direction === "export" ? partner : reporter;
    return [{
      id: record.id, kind: "trade", fromCountryId: from.id, toCountryId: to.id,
      fromM49: from.m49!, toM49: to.m49!, itemName: view.item?.name ?? "未关联商品", stageLabel: null,
      reporterName: reporter.name, reporterId: reporter.id, direction: record.direction, periodLabel: record.period.label,
      value: record.value ?? null, currency: record.currency ?? null, valueDataStatus: view.valueDataStatus,
      quantity: record.quantity ?? null, unit: record.unit ?? null, quantityDataStatus: view.quantityDataStatus,
      method: record.method, datasetVersion: network!.datasetVersion.version, contentVersion: null,
      classification: `${record.classificationSystem} ${record.classificationVersion} · ${record.classificationCode}`,
      evidenceLabel: "官方双边贸易观察", evidenceDescription: "报告方、伙伴、分类和期间明确的海关统计；不证明进入某件商品或连续供应链。",
      notes: null, sources: view.source ? [view.source] : [], fromNodeId: null, toNodeId: null
    }];
  }) ?? [];
  const routeLines: MapLine[] = story?.flows.flatMap(view => {
    const from = view.from.entity; const to = view.to.entity;
    if (!from?.m49 || !to?.m49) return [];
    const record = view.flow;
    return [{
      id: record.id, kind: "supply-chain", fromCountryId: from.id, toCountryId: to.id,
      fromM49: from.m49, toM49: to.m49, itemName: view.item?.name ?? "未关联商品", stageLabel: view.processStage?.label ?? null,
      reporterName: null, reporterId: null, direction: null, periodLabel: record.period.label,
      value: record.value ?? null, currency: record.currency ?? null, valueDataStatus: view.valueDataStatus,
      quantity: record.quantity ?? null, unit: record.unit ?? null, quantityDataStatus: view.quantityDataStatus,
      method: record.method, datasetVersion: view.datasetVersion?.version ?? story!.datasetVersion.version,
      contentVersion: view.contentVersion?.version ?? null, classification: null,
      evidenceLabel: view.evidenceLevel.label, evidenceDescription: view.evidenceLevel.description, notes: record.notes ?? null,
      sources: view.sources, fromNodeId: view.from.node?.node.id ?? null, toNodeId: view.to.node?.node.id ?? null
    }];
  }) ?? [];
  const nodes: MapNode[] = story?.nodes.flatMap(view => view.entity ? [{
    id: view.node.id, countryId: view.entity.id, label: view.node.label, itemName: view.item?.name ?? "未关联商品",
    stageLabel: view.processStage?.label ?? "未提供环节", periodLabel: view.period.label, evidenceLabel: view.evidenceLevel.label
  }] : []) ?? [];
  const countries: MapCountry[] = queries.listCountries().filter(country => country.productIds.includes(filters.product)).map(({ entity }) => {
    const ledger = queries.getCountryLedger(filters.product, entity.id);
    return {
      id: entity.id, name: entity.name, m49: entity.m49 ?? null,
      roles: [...new Set(nodes.filter(node => node.countryId === entity.id).map(node => `${node.itemName} · ${node.stageLabel}`))],
      hasTradeLedger: Boolean(ledger && (ledger.tradeObservations.length || ledger.macroIndicators.length)),
      hasTradeRecords: tradeLines.some(line => line.fromCountryId === entity.id || line.toCountryId === entity.id),
      hasRouteNodes: nodes.some(node => node.countryId === entity.id)
    };
  });
  const selectedLines = layer === "trade" ? tradeLines : routeLines;
  const lines = selectedLines.filter(line => !filters.country || line.fromCountryId === filters.country || line.toCountryId === filters.country);
  return { countries, lines, nodes: layer === "supply-chain" ? nodes : [], years, items, layer, datasetVersion: overview.datasetVersion.version, routeStatement: story?.route.representativeStatement ?? null };
}
