import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService, type ProductQueryService } from "@globe-chain/domain";
import { productHasReachableLedger } from "../apps/web/lib/ledger-empty-state";
import { ledgerPath, UNKNOWN_LEDGER_ENTITY_ID } from "../apps/web/lib/paths";

// The drone used to carry no country at all, so its ledger page could only ever
// show the reserved empty state. The 2026-11-27 China-hub batch gives it a real
// 2023 ledger, so this file now guards that transition instead of the absence.
describe("country ledger availability", () => {
  let queries: ProductQueryService;

  beforeAll(async () => {
    queries = createProductQueryService(await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json")));
  });

  it("resolves a real ledger for the drone now that China-hub trade is published", () => {
    const productId = "generic-camera-drone";
    expect(queries.getProductOverview(productId)).not.toBeNull();
    expect(queries.getProvenance(productId)).not.toBeNull();
    expect(productHasReachableLedger(queries.listCountries(), productId)).toBe(true);
    expect(queries.getCountryLedger(productId, "country-cn")).not.toBeNull();
  });

  it("keeps the reserved unknown id out of every ledger", () => {
    for (const productId of ["generic-camera-drone", "generic-smartphone"]) {
      expect(queries.getCountryLedger(productId, UNKNOWN_LEDGER_ENTITY_ID)).toBeNull();
      expect(queries.getCountryLedger(productId, "country-zz")).toBeNull();
    }
    expect(ledgerPath("generic-camera-drone", UNKNOWN_LEDGER_ENTITY_ID, {})).toBe("/products/generic-camera-drone/ledger/country-unknown");
  });

  it("still resolves published ledgers for the smartphone", () => {
    expect(productHasReachableLedger(queries.listCountries(), "generic-smartphone")).toBe(true);
    expect(queries.getCountryLedger("generic-smartphone", "country-au")).not.toBeNull();
  });
});
