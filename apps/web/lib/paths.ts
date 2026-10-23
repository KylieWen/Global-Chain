import { contextQuery, type PageContext } from "./context";

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

export function industryPath(productId: string, topicId?: string, context?: PageContext): string {
  return `/products/${segment(productId)}/industry${contextQuery({ ...context, ...(topicId ? { topic: topicId } : {}) })}`;
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

export function materialObservationsPath(productId: string, context?: PageContext): string {
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
  year?: string;
};

export function mapPath(filters?: MapFilters): string {
  return `/map${contextQuery(filters)}`;
}

export function chinaMapPath(filters?: PageContext & {product?: string; province?: string; stage?: string; node?: string}): string {
  return `/map/china${contextQuery(filters)}`;
}
