import type { PageContext } from "./context";
import {
  ledgerPath,
  manufacturingProcessPath,
  mapPath,
  materialObservationsPath,
  supplyChainPath,
  UNKNOWN_LEDGER_ENTITY_ID
} from "./paths";
import type { ExplodedNode, LedgerEntityRef } from "./exploded-model";

const MATERIAL_TYPES = new Set(["material", "raw_material"]);

export type ExplodedLedgerLink = LedgerEntityRef & { readonly href: string };

export type ExplodedNodeLinks = {
  readonly routeHref: string | null;
  readonly processHref: string | null;
  readonly tradeMapHref: string | null;
  readonly materialHref: string | null;
  readonly ledgerHrefs: readonly ExplodedLedgerLink[];
};

/**
 * Resolve the real destination links for a selected exploded node. Links reuse the
 * existing page routes and page context; no new query or relation is built here.
 */
export function explodedLinks(
  productId: string,
  node: ExplodedNode,
  context: PageContext
): ExplodedNodeLinks {
  const routeHref = node.hasRoute ? supplyChainPath(productId, node.id, context) : null;
  const processHref = node.hasProcessChain && node.processChainId
    ? manufacturingProcessPath(productId, node.processChainId, context)
    : null;
  const tradeMapHref = node.depth > 0
    ? mapPath({ ...context, product: productId, layer: "trade", items: node.id })
    : null;
  const materialHref = MATERIAL_TYPES.has(node.itemType)
    ? materialObservationsPath(productId, { ...context, material: node.id })
    : null;
  const ledgerHrefs = node.ledgerEntities.map((entity) => ({
    ...entity,
    href: ledgerPath(productId, entity.id, context)
  }));
  return { routeHref, processHref, tradeMapHref, materialHref, ledgerHrefs };
}

/**
 * Reserved destination for products without a published ledger entity. The
 * ledger page renders a generic pending-verification empty state for this id;
 * it never stands in for a real country or region.
 */
export function ledgerFallbackHref(productId: string, context: PageContext): string {
  return ledgerPath(productId, UNKNOWN_LEDGER_ENTITY_ID, context);
}
