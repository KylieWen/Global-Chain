import type { CountryCatalogView } from "@globe-chain/domain";

/**
 * A product has a reachable country/region ledger only when an existing
 * country catalog entry links it through a story role or a published
 * trade/macro ledger. Products with neither stay on the reserved
 * pending-verification entity instead of inventing a country code.
 */
export function productHasReachableLedger(
  countries: readonly CountryCatalogView[],
  productId: string
): boolean {
  return countries.some(
    (country) => country.productIds.includes(productId) || country.ledgerProductIds.includes(productId)
  );
}
