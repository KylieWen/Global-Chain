import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";

describe("local published fixture", () => {
  it("passes the fixture loader and published status filter", async () => {
    const repository = await loadFixtureRepositoryFromManifest(
      resolve("data/published/manifest.json"),
      { allowedStatuses: ["published"] }
    );
    const fixture = repository.getProductFixture("generic-smartphone");
    expect(fixture.datasetVersion.status).toBe("published");
    expect(fixture.tradeObservations.length).toBe(16);
    expect(fixture.macroIndicators.length).toBe(36);
    expect(fixture.tradeObservations.some((row) => row.reporterEntityId === "country-cd")).toBe(false);
    expect(fixture.entities.every((entity) => /^\d{3}$/.test(entity.m49 ?? ""))).toBe(true);
    expect(
      fixture.tradeObservations
        .filter((row) => row.dataStatus === "estimated")
        .every((row) => row.quantity === null && row.unit === null)
    ).toBe(true);
    expect(fixture.macroIndicators.filter((row) => row.indicator === "merchandise_trade_balance_current_usd")).toHaveLength(9);
  });
});
