import { contextQuery, type PageContext } from "./context";

/** Reserved entity id for products with no published country/region ledger yet. */
export const UNKNOWN_LEDGER_ENTITY_ID = "country-unknown";

function segment(value: string): string {
  return encodeURIComponent(value);
}

export function productPath(productId: string, context?: PageContext): string {
  return `/products/${segment(productId)}${contextQuery(context)}`;
}

export function supplyChainPath(productId: string, focusItemId?: string, context?: PageContext): string {
  const query = { ...context, ...(focusItemId ? { focus: focusItemId } : {}) };
  return `/products/${segment(productId)}/supply-chain${contextQuery(query)}`;
}

export function industryPath(productId: string, topicId?: string, context?: PageContext, extras?: { china?: string }): string {
  const query = { ...context, ...(topicId ? { topic: topicId } : {}), ...(extras?.china ? { china: extras.china } : {}) };
  return `/products/${segment(productId)}/industry${contextQuery(query)}`;
}

export function nodePath(productId: string, nodeId: string, context?: PageContext): string {
  return `/products/${segment(productId)}/nodes/${segment(nodeId)}${contextQuery(context)}`;
}

export function ledgerPath(productId: string, entityId: string, context?: PageContext): string {
  return `/products/${segment(productId)}/ledger/${segment(entityId)}${contextQuery(context)}`;
}

export function provenancePath(productId: string, context?: PageContext): string {
  return `/products/${segment(productId)}/provenance${contextQuery(context)}`;
}

export function researchExportPath(productId: string, context?: PageContext): string {
  return `/api/products/${segment(productId)}/research-export${contextQuery({ datasetVersion: context?.datasetVersion })}`;
}

export function evidenceGapsPath(productId: string, context?: PageContext): string {
  return `/products/${segment(productId)}/evidence-gaps${contextQuery(context)}`;
}

export type MaterialObservationsFilters = PageContext & {
  material?: string;
  partnerScope?: string;
  flow?: string;
  mapping?: string;
};

export function materialObservationsPath(productId: string, context?: MaterialObservationsFilters): string {
  return `/products/${segment(productId)}/materials${contextQuery(context)}`;
}

export function materialObservationPath(productId: string, observationId: string, context?: PageContext): string {
  return `/products/${segment(productId)}/materials/${segment(observationId)}${contextQuery(context)}`;
}

export function manufacturingProcessPath(productId: string, processChainId: string, context?: PageContext): string {
  return `/products/${segment(productId)}/processes/${segment(processChainId)}${contextQuery(context)}`;
}

export type TradeGuideFilters = PageContext & {
  product?: string;
  jurisdiction?: string;
  direction?: "import" | "export";
};

export function tradeGuidePath(filters?: TradeGuideFilters): string {
  return `/trade-guide${contextQuery(filters)}`;
}

export type MapFilters = PageContext & {
  product?: string;
  country?: string;
  direction?: "import" | "export";
  layer?: "supply-chain" | "trade";
  scope?: "bilateral" | "world";
  focus?: string;
  items?: string;
  currency?: string;
  measure?: "quantity";
  unit?: string;
  year?: string;
};

export function mapPath(filters?: MapFilters): string {
  return `/map${contextQuery(filters)}`;
}

export type ChinaMapFilters = PageContext & {
  product?: string;
  province?: string;
  stage?: string;
  node?: string;
  /** Encoded upstream world-map search string, preserved on the China round trip. */
  map?: string;
};

export function chinaMapPath(filters?: ChinaMapFilters): string {
  return `/map/china${contextQuery(filters)}`;
}

/** Non-empty query entries kept for nested cross-map state (`map=` / `china=`). */
function serializableEntries(filters: Record<string, string | undefined>): Record<string, string> {
  const entries = Object.entries(filters).filter((value): value is [string, string] => value[1] !== undefined && value[1] !== "");
  return Object.fromEntries(entries);
}

/** Serialize world-map filters into the inner query string stored in the nested `map` parameter. */
export function worldStateSearch(filters?: Partial<MapFilters>): string {
  if (!filters) return "";
  return new URLSearchParams(serializableEntries(filters as Record<string, string | undefined>)).toString();
}

/** Serialize China-map filters (including the nested upstream `map` search) into the inner `china` parameter. */
export function chinaStateSearch(filters?: Partial<ChinaMapFilters>): string {
  if (!filters) return "";
  return new URLSearchParams(serializableEntries(filters as Record<string, string | undefined>)).toString();
}

/** Read the nested world filters encoded in a `map` / `china` inner search string. */
export function filtersFromNestedSearch(search: string | undefined): MapFilters {
  const params = new URLSearchParams(search ?? "");
  const read = (key: string) => params.get(key) ?? undefined;
  const direction = read("direction");
  const layer = read("layer");
  const scope = read("scope");
  return {
    period: read("period"),
    datasetVersion: read("datasetVersion"),
    contentVersion: read("contentVersion"),
    label: read("label"),
    product: read("product"),
    country: read("country"),
    direction: direction === "import" || direction === "export" ? direction : undefined,
    layer: layer === "supply-chain" || layer === "trade" ? layer : undefined,
    scope: scope === "bilateral" || scope === "world" ? scope : undefined,
    focus: read("focus"),
    items: read("items"),
    currency: read("currency"),
    measure: read("measure") === "quantity" ? "quantity" : undefined,
    unit: read("unit"),
    year: read("year")
  };
}

/** Read the nested China filters encoded in a `china` inner search string. */
export function chinaFiltersFromNestedSearch(search: string | undefined): { province?: string; stage?: string; node?: string; map?: string } {
  const params = new URLSearchParams(search ?? "");
  const read = (key: string) => params.get(key) ?? undefined;
  return { province: read("province"), stage: read("stage"), node: read("node"), map: read("map") };
}
