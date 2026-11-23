import type { PageContext } from "./context";
import { contextQuery } from "./context";
import { ledgerPath, mapPath, productPath, supplyChainPath } from "./paths";

export type PathStepId = "breakdown" | "route" | "ledger";

export type PathStep = {
  id: PathStepId;
  label: string;
  href: string;
  active: boolean;
};

export type PathStepInput = {
  pathname: string;
  /** Explicit product context (server pages pass it directly). */
  productId?: string;
  /** Selected country / entity when one is in context, for a direct ledger link. */
  entityId?: string;
  context?: PageContext;
  /** Fallback product id read from the query string when the shell renders without props. */
  searchProduct?: string;
};

const STEP_META: ReadonlyArray<{ id: PathStepId; label: string }> = [
  { id: "breakdown", label: "拆解" },
  { id: "route", label: "路线" },
  { id: "ledger", label: "账本" }
];

const PRODUCT_SUBPATHS = ["supply-chain", "ledger", "materials", "industry", "nodes", "provenance", "processes", "evidence-gaps"];

function resolveProductId(input: PathStepInput): string | undefined {
  if (input.productId) return input.productId;
  if (input.searchProduct) return input.searchProduct;
  const match = /^\/products\/([^/]+)/.exec(input.pathname);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function activeStep(pathname: string, productId: string | undefined): PathStepId {
  if (pathname.startsWith("/products/") && productId) {
    const tail = pathname.slice(`/products/${productId}`.length).replace(/^\/+/, "");
    const section = tail.split("/")[0] ?? "";
    if (section === "supply-chain" || section === "nodes") return "route";
    if (section === "ledger") return "ledger";
    return "breakdown";
  }
  if (pathname === "/map" || pathname === "/map/china") return "route";
  if (pathname === "/countries" || pathname.includes("/ledger/")) return "ledger";
  return "breakdown";
}

/**
 * Resolve the three-step journey links (拆解 → 路线 → 账本) from the current
 * route and product context. Links carry the existing page context; when no
 * product is in scope, steps fall back to the catalog / map / countries entry.
 */
export function resolvePathSteps(input: PathStepInput): PathStep[] {
  const productId = resolveProductId(input);
  const active = activeStep(input.pathname, productId);
  const breakdownHref = productId ? productPath(productId, input.context) : "/products";
  const routeHref = productId ? supplyChainPath(productId, undefined, input.context) : mapPath(input.context);
  const ledgerHref = productId
    ? input.entityId
      ? ledgerPath(productId, input.entityId, input.context)
      : `/countries${contextQuery(input.context)}`
    : "/countries";

  return STEP_META.map(meta => ({
    id: meta.id,
    label: meta.label,
    href: meta.id === "breakdown" ? breakdownHref : meta.id === "route" ? routeHref : ledgerHref,
    active: active === meta.id
  }));
}

/** Derive the product id embedded in a product-scoped path, for shell-level context. */
export function productIdFromPathname(pathname: string): string | undefined {
  const match = /^\/products\/([^/]+)/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export { PRODUCT_SUBPATHS };
