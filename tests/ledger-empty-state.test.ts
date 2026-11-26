import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService, type ProductQueryService } from "@globe-chain/domain";
import { productHasReachableLedger } from "../apps/web/lib/ledger-empty-state";
import { ledgerPath, UNKNOWN_LEDGER_ENTITY_ID } from "../apps/web/lib/paths";

describe("country ledger pending-verification empty state", () => {
  let queries: ProductQueryService;

  beforeAll(async () => {
    queries = createProductQueryService(await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json")));
  });

  it("keeps a product without any story role or trade ledger on the reserved unknown entity", () => {
    const productId = "generic-camera-drone";
    expect(queries.getProductOverview(productId)).not.toBeNull();
    expect(queries.getProvenance(productId)).not.toBeNull();

    expect(productHasReachableLedger(queries.listCountries(), productId)).toBe(false);
    for (const country of queries.listCountries()) {
      expect(country.productIds).not.toContain(productId);
      expect(country.ledgerProductIds).not.toContain(productId);
    }

    // The reserved unknown id and any real-looking country code both resolve to
    // no ledger record; the page renders the generic empty state only for the
    // reserved id, and stays 404 for other unknown entities.
    expect(queries.getCountryLedger(productId, UNKNOWN_LEDGER_ENTITY_ID)).toBeNull();
    expect(queries.getCountryLedger(productId, "country-cn")).toBeNull();
    expect(ledgerPath(productId, UNKNOWN_LEDGER_ENTITY_ID, {})).toBe(`/products/${productId}/ledger/country-unknown`);
  });

  it("still resolves real published ledgers and does not treat the unknown id as an entity", () => {
    expect(productHasReachableLedger(queries.listCountries(), "generic-smartphone")).toBe(true);
    expect(queries.getCountryLedger("generic-smartphone", "country-au")).not.toBeNull();
    expect(queries.getCountryLedger("generic-smartphone", UNKNOWN_LEDGER_ENTITY_ID)).toBeNull();
  });
});
