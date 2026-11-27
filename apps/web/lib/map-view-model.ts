import { itemLabel } from "./item-label";
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

export type MapRecord = {
  id: string;
  observationId: string;
  kind: "trade" | "supply-chain";
  recordKind: "product_trade" | "material_trade" | "supply_chain";
  partnerScope: "entity" | "world_total" | "unspecified" | "not_applicable";
  fromCountryId: string | null;
  toCountryId: string | null;
  fromLabel?: string | null;
  toLabel?: string | null;
  fromM49: string | null;
  toM49: string | null;
  itemId: string | null;
  itemName: string;
  stageLabel: string | null;
  reporterName: string | null;
  reporterId: string | null;
  reporterM49: string | null;
  direction: "import" | "export" | null;
  periodLabel: string;
  value: number | null;
  currency: string | null;
  valueDataStatus: string;
  quantity: number | null;
  unit: string | null;
  quantityDataStatus: string;
  method: string;
  datasetVersion: string | null;
  contentVersion: string | null;
  classification: string | null;
  classificationCode: string | null;
  classificationLabel: string | null;
  classificationMappingType: string | null;
  evidenceCode: string | null;
  evidenceLabel: string;
  notes: string | null;
  sources: readonly Source[];
  fromNodeId: string | null;
  toNodeId: string | null;
};

export type MapLine = MapRecord & { fromCountryId: string; toCountryId: string; fromM49: string; toM49: string };
export type MapItemOption = { id: string; name: string; depth: number; directTradeCount: number; relatedTradeCount: number };
export type MapNode = { id: string; countryId: string; label: string; itemName: string; stageLabel: string; periodLabel: string; evidenceLabel: string };

export function mapItemOptions(node: ProductBreakdownNode): { id: string; name: string; depth: number }[] {
  return [{ id: node.item.id, name: itemLabel(node.item), depth: node.depth }, ...node.children.flatMap(mapItemOptions)];
}

function findItem(node: ProductBreakdownNode, id: string): ProductBreakdownNode | null {
  if (node.item.id === id) return node;
  for (const child of node.children) {
    const found = findItem(child, id);
    if (found) return found;
  }
  return null;
}

/** Walk each direction independently: shared assembly nodes must not pull in other component inputs. */
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

function isMapLine(record: MapRecord): record is MapLine {
  return record.partnerScope === "entity" && Boolean(record.fromCountryId && record.toCountryId && record.fromM49 && record.toM49);
}

/** Consume resolved domain statistics; world totals remain records, never become bilateral geometry. */
export function createMapView(queries: ProductQueryService, filters: MapFilters & { product: string }) {
  const overview = queries.getProductOverview(filters.product);
  const breakdown = queries.getProductBreakdown(filters.product);
  if (!overview || !breakdown) return null;
  const focus = filters.focus || undefined;
  const baseTrade = queries.getTradeMapView(filters.product, { focusItemId: focus });
  if (!baseTrade) return null;
  const items: MapItemOption[] = mapItemOptions(breakdown).map(item => {
    const coverage = baseTrade.itemCoverage.find(candidate => candidate.item.id === item.id);
    return { ...item, directTradeCount: coverage?.directObservationCount ?? 0, relatedTradeCount: coverage?.relatedObservationCount ?? 0 };
  });
  const layer = filters.layer ?? "supply-chain";
  const selectedItemIds = [...new Set(filters.items?.split(","))].filter(id => items.some(item => item.id === id));
  if (!selectedItemIds.length) selectedItemIds.push(baseTrade.selectedItem.id);
  const compareTrade = layer === "trade" && filters.items !== undefined;
  const tradeCoverage = compareTrade ? selectedItemIds.flatMap(focusItemId =>
    queries.getTradeMapView(filters.product, { focusItemId })?.observations.filter(record => record.item?.id === focusItemId) ?? []
  ) : baseTrade.observations;
  const scope = filters.scope ?? (tradeCoverage.some(record => record.partnerScope === "entity") ? "bilateral" : "world");
  const matchesScope = (record: { partnerScope: string }) => scope === "world" ? record.partnerScope === "world_total" : record.partnerScope === "entity";
  const allBaseStory = queries.getSupplyChainStory(filters.product);
  const baseStory = allBaseStory ? mapStoryWithContext(allBaseStory, breakdown, focus) : null;
  const years = [...new Set(layer === "trade"
    ? tradeCoverage.filter(matchesScope).map(record => record.period.label)
    : [...(baseStory?.nodes.map(view => view.period.label) ?? []), ...(baseStory?.flows.map(view => view.flow.period.label) ?? [])])].sort().reverse();
  // Default year = the year with the densest record set, so a product opens on
  // its richest map instead of a sparse later year with only world totals.
  const coverageByYear = new Map(years.map(year => [year, tradeCoverage.filter(record => matchesScope(record) && record.period.label === year).length]));
  const bestYear = [...years].sort((a, b) => coverageByYear.get(b)! - coverageByYear.get(a)! || b.localeCompare(a))[0];
  const selectedYear = filters.year ?? (compareTrade ? bestYear : undefined);
  const currencies = [...new Set(tradeCoverage.filter(record => matchesScope(record) && record.period.label === selectedYear).flatMap(record => record.currency ?? []))].sort();
  const selectedCurrency = filters.currency && currencies.includes(filters.currency) ? filters.currency : currencies[0];
  const allStory = queries.getSupplyChainStory(filters.product, { label: filters.year });
  const story = allStory ? mapStoryWithContext(allStory, breakdown, focus) : null;
  const selection = compareTrade && selectedYear && selectedCurrency ? queries.selectTradeFlows(filters.product, { itemIds: selectedItemIds, year: selectedYear, currency: selectedCurrency, direction: filters.direction, exactItems: true }) : null;
  const observations = compareTrade
    ? [...(selection?.flows.filter(flow => flow.isPreferredRecord) ?? []), ...(selection?.worldTotals ?? [])].map(flow => flow.observation)
    : queries.getTradeMapView(filters.product, { focusItemId: focus, label: filters.year, direction: filters.direction })!.observations;
  const tradeRecords: MapRecord[] = observations.map(record => {
    const from = record.direction === "export" ? record.reporter : record.partner;
    const to = record.direction === "export" ? record.partner : record.reporter;
    return {
      id: `${record.recordKind}:${record.id}`, observationId: record.id, kind: "trade", recordKind: record.recordKind, partnerScope: record.partnerScope,
      fromCountryId: from?.id ?? null, toCountryId: to?.id ?? null, fromM49: from?.m49 ?? null, toM49: to?.m49 ?? null,
      itemId: record.item?.id ?? null, itemName: itemLabel(record.item), stageLabel: null,
      reporterName: record.reporter?.name ?? null, reporterId: record.reporter?.id ?? null, reporterM49: record.reporter?.m49 ?? null,
      direction: record.direction, periodLabel: record.period.label,
      value: record.value, currency: record.currency, valueDataStatus: record.valueDataStatus,
      quantity: record.quantity, unit: record.unit, quantityDataStatus: record.quantityDataStatus,
      method: record.method, datasetVersion: record.datasetVersion?.version ?? null, contentVersion: null,
      classification: `${record.classification.system} ${record.classification.version} · ${record.classification.code}`,
      classificationCode: record.classification.code, classificationLabel: record.classification.label, classificationMappingType: record.classification.mappingType,
      evidenceCode: null, evidenceLabel: record.partnerScope === "world_total" ? "世界总计" : "双边统计", notes: record.limitation,
      sources: record.source ? [record.source] : [], fromNodeId: null, toNodeId: null
    };
  });
  const routeRecords: MapRecord[] = story?.flows.map(view => ({
    id: view.flow.id, observationId: view.flow.id, kind: "supply-chain", recordKind: "supply_chain", partnerScope: "entity",
    fromCountryId: view.from.entity?.id ?? null, toCountryId: view.to.entity?.id ?? null,
    fromLabel: view.from.node?.node.label ?? null, toLabel: view.to.node?.node.label ?? null,
    fromM49: view.from.entity?.m49 ?? null, toM49: view.to.entity?.m49 ?? null,
    itemId: view.item?.id ?? null, itemName: itemLabel(view.item), stageLabel: view.processStage?.label ?? null,
    reporterName: null, reporterId: null, reporterM49: null, direction: null, periodLabel: view.flow.period.label,
    value: view.flow.value ?? null, currency: view.flow.currency ?? null, valueDataStatus: view.valueDataStatus,
    quantity: view.flow.quantity ?? null, unit: view.flow.unit ?? null, quantityDataStatus: view.quantityDataStatus,
    method: view.flow.method, datasetVersion: view.datasetVersion?.version ?? null, contentVersion: view.contentVersion?.version ?? null,
    classification: null, classificationCode: null, classificationLabel: null, classificationMappingType: null,
    evidenceCode: view.evidenceLevel.code, evidenceLabel: view.evidenceLevel.label, notes: view.flow.notes ?? null, sources: view.sources,
    fromNodeId: view.from.node?.node.id ?? null, toNodeId: view.to.node?.node.id ?? null
  })) ?? [];
  const nodes: MapNode[] = story?.nodes.flatMap(view => view.entity ? [{
    id: view.node.id, countryId: view.entity.id, label: view.node.label, itemName: itemLabel(view.item),
    stageLabel: view.processStage?.label ?? "生产环节", periodLabel: view.period.label, evidenceLabel: view.evidenceLevel.label
  }] : []) ?? [];
  const concernsCountry = (record: MapRecord) => !filters.country || record.reporterId === filters.country || record.fromCountryId === filters.country || record.toCountryId === filters.country;
  const activeTradeRecords = tradeRecords.filter(matchesScope);
  const countries: MapCountry[] = queries.listCountries().filter(country => country.productIds.includes(filters.product)).map(({ entity }) => {
    const ledger = queries.getCountryLedger(filters.product, entity.id);
    return {
      id: entity.id, name: entity.name, m49: entity.m49 ?? null,
      roles: [...new Set(nodes.filter(node => node.countryId === entity.id).map(node => `${node.itemName} · ${node.stageLabel}`))],
      hasTradeLedger: Boolean(ledger && (ledger.tradeObservations.length || ledger.macroIndicators.length)),
      hasTradeRecords: activeTradeRecords.some(record => record.reporterId === entity.id || record.fromCountryId === entity.id || record.toCountryId === entity.id),
      hasRouteNodes: nodes.some(node => node.countryId === entity.id)
    };
  });
  const records = (layer === "trade" ? activeTradeRecords : routeRecords).filter(concernsCountry);
  const relatedMaterials = compareTrade ? [] : baseTrade.relatedItems.filter(item => item.id !== baseTrade.selectedItem.id).map(item => ({ id: item.id, name: itemLabel(item) }));
  return {
    countries, records, lines: records.filter(isMapLine), nodes: layer === "supply-chain" ? nodes : [], years, items, layer, scope,
    compareTrade, selectedItemIds, selectedYear, currencies, selectedCurrency,
    datasetVersion: overview.datasetVersion.version, selectedItemName: itemLabel(baseTrade.selectedItem), relatedMaterials,
    hasFocusTradeCoverage: tradeCoverage.length > 0,
    scopeCounts: { bilateral: tradeRecords.filter(record => record.partnerScope === "entity" && concernsCountry(record)).length, world: tradeRecords.filter(record => record.partnerScope === "world_total" && concernsCountry(record)).length }
  };
}

export type MapViewModel = NonNullable<ReturnType<typeof createMapView>>;
