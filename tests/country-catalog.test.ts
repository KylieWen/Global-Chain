import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService, type ProductQueryService } from "@globe-chain/domain";

describe("country entry points across published products", () => {
  let queries: ProductQueryService;
  beforeAll(async () => {
    queries = createProductQueryService(await loadFixtureRepositoryFromManifest(resolve("data/published/active-manifest.json")));
  });

  it("keeps a later product's real ledger reachable when the first related product has only a route", () => {
    const brazil = queries.listCountries().find(({ entity }) => entity.iso3 === "BRA")!;
    expect(brazil.productIds[0]).toBe("generic-cotton-tshirt");
    expect(brazil.ledgerProductIds).not.toContain("generic-cotton-tshirt");
    expect(brazil.ledgerProductIds).toContain("generic-soybean-oil");
    const ledger = queries.getCountryLedger(brazil.ledgerProductIds[0]!, brazil.entity.id)!;
    expect(ledger.macroIndicators.length + ledger.tradeObservations.length).toBeGreaterThan(0);
  });

  it("does not turn a country with production roles alone into an empty ledger entry", () => {
    const bangladesh = queries.listCountries().find(({ entity }) => entity.iso3 === "BGD")!;
    expect(bangladesh.productIds).toContain("generic-cotton-tshirt");
    expect(bangladesh.relatedNodeCount).toBeGreaterThan(0);
    expect(bangladesh.ledgerProductIds).toEqual([]);
    expect(bangladesh.hasTradeLedger).toBe(false);
  });

  it("only offers product ledgers that contain that country's published statistics", () => {
    for (const country of queries.listCountries()) {
      expect(country.hasTradeLedger).toBe(country.ledgerProductIds.length > 0);
      for (const productId of country.ledgerProductIds) {
        expect(country.productIds).toContain(productId);
        const ledger = queries.getCountryLedger(productId, country.entity.id)!;
        expect(ledger.tradeObservations.length + ledger.macroIndicators.length).toBeGreaterThan(0);
      }
    }
  });
});
