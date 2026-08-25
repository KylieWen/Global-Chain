import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

const loadQueries = async () => createProductQueryService(
  await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json"))
);

describe("phase 14 versioned research export", () => {
  it("exports every published module with dataset and content versions", async () => {
    const queries = await loadQueries();
    const researchExport = queries.getProductResearchExport("generic-smartphone");

    expect(researchExport?.formatVersion).toBe("product-research-export.v1");
    expect(researchExport?.release.datasetVersion.version).toBe("globe-chain-smartphone-2023.7");
    expect(researchExport?.release.contentVersions.map(({ version }) => version)).toContain("smartphone-route-2023.3");
    expect(researchExport?.release.period.label).toBe("2023");
    expect(researchExport?.includedModules).toEqual([
      "catalog",
      "supply_chain",
      "trade_ledger",
      "material_trade",
      "provenance",
      "evidence_gaps"
    ]);
    expect(researchExport?.recordCounts.storyFlows).toBe(13);
    expect(researchExport?.recordCounts.evidenceGaps).toBe(38);
    expect(researchExport?.recordCounts.materialTradeObservations).toBeGreaterThan(0);
  });

  it("preserves evidence boundaries and unknown values in the exported snapshot", async () => {
    const queries = await loadQueries();
    const researchExport = queries.getProductResearchExport("generic-smartphone");

    expect(researchExport?.snapshot.storyGraph.flows.every((flow) =>
      flow.evidenceLevel === "representative" &&
      flow.value === null &&
      flow.quantity === null &&
      flow.valueDataStatus === "unknown" &&
      flow.quantityDataStatus === "unknown"
    )).toBe(true);
    expect(researchExport?.interpretationRules).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "customs_trade_is_not_end_use" }),
      expect.objectContaining({ code: "trade_value_is_not_profit" }),
      expect.objectContaining({ code: "unknown_is_not_zero" })
    ]));
  });

  it("is immutable, deterministic and generic across fixture products", async () => {
    const queries = await loadQueries();
    const first = queries.getProductResearchExport("generic-smartphone");
    const second = queries.getProductResearchExport("generic-smartphone");

    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first?.recordCounts)).toBe(true);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(queries.getProductResearchExport("missing-product")).toBeNull();
  });
});
