import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EvidenceSchema, ProductFixtureSchema } from "@globe-chain/contracts";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";
import publishedFixture from "../data/published/releases/generic-smartphone/globe-chain-smartphone-2023.16/fixture.json";
import sampleFixture from "../data/samples/smartphone/fixture.json";

async function loadQueries() {
  const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
  return createProductQueryService(repository);
}

describe("trade guidance pivot", () => {
  it("validates policy evidence separately from trade observations", () => {
    const fixture = ProductFixtureSchema.parse(publishedFixture);
    const policyEvidence = fixture.evidence.find((record) => record.supportType === "policy_guidance");
    expect(policyEvidence?.scope?.supportsPolicyGuidance).toBe(true);
    expect(policyEvidence?.scope?.supportsBilateralFlow).toBe(false);
    expect(EvidenceSchema.parse(policyEvidence).supportType).toBe("policy_guidance");
  });

  it("returns resolved guides without making pages decode source IDs", async () => {
    const queries = await loadQueries();
    const guides = queries.getTradeGuides("generic-smartphone", { jurisdictionEntityId: "country-us", direction: "import" });
    expect(guides).toHaveLength(1);
    const guide = guides[0];
    expect(guide.jurisdiction?.name).toBe("美国");
    expect(guide.directionLabel).toBe("进口");
    expect(guide.coverageLabel).toBe("部分覆盖");
    expect(guide.tariffs[0].measure.rateValue).toBe(0);
    expect(guide.tariffs[0].measure.limitations.join(" ")).toContain("Chapter 99");
    expect(guide.tariffs[1].displayValue).toContain("未收录");
    expect(guide.requirements[0].requirementTypeLabel).toBe("海关申报");
    expect(guide.procedures[0].steps.length).toBeGreaterThan(2);
    expect(guide.sources.some((source) => source.publisher.includes("Customs"))).toBe(true);
    expect(guide.evidence[0].evidence.supportType).toBe("policy_guidance");
  });

  it("keeps import and export scopes independent and reusable", async () => {
    const queries = await loadQueries();
    const chinaImport = queries.getTradeGuides("generic-smartphone", { jurisdictionEntityId: "country-cn", direction: "import" });
    const chinaExport = queries.getTradeGuides("generic-smartphone", { jurisdictionEntityId: "country-cn", direction: "export" });
    expect(chinaImport).toHaveLength(1);
    expect(chinaExport).toHaveLength(1);
    expect(chinaImport[0].guide.scope.destinationEntityId).toBe("country-cn");
    expect(chinaExport[0].guide.scope.originEntityId).toBeNull();
    expect(chinaExport[0].directionLabel).toBe("出口");
    expect(queries.getTradeGuide("generic-smartphone", "guide-de-import-smartphone-2023")?.jurisdiction?.id).toBe("country-de");
  });

  it("does not add trade guidance fields to sample fixtures", () => {
    expect(Object.prototype.hasOwnProperty.call(sampleFixture, "tradeGuides")).toBe(false);
  });
});
