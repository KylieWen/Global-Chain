import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

const productId = "generic-smartphone";
const targetGapIds = [
  "gap-flow-copper-intermediate-stages",
  "gap-flow-aluminum-intermediate-stages",
  "gap-flow-cathode-cell-bilateral",
  "gap-flow-anode-cell-bilateral"
] as const;

const loadContext = async () => {
  const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json"));
  return {
    fixture: repository.getProductFixture(productId),
    queries: createProductQueryService(repository)
  };
};

describe("phase 13 intermediate observations linked to evidence gaps", () => {
  it("marks the four intermediate-stage gaps partial without upgrading route claims", async () => {
    const { fixture, queries } = await loadContext();
    const gaps = new Map(fixture?.evidenceGaps.map((gap) => [gap.gapId, gap]));

    for (const gapId of targetGapIds) {
      expect(gaps.get(gapId)?.status).toBe("partial");
      expect(gaps.get(gapId)?.currentEvidenceLevel).toBe("representative");
    }

    const story = queries.getSupplyChainStory(productId);
    expect(story?.flows.every(({ flow }) =>
      flow.evidenceLevel === "representative" &&
      flow.value === null &&
      flow.quantity === null &&
      flow.valueDataStatus === "unknown" &&
      flow.quantityDataStatus === "unknown"
    )).toBe(true);
  });

  it.each([
    ["741011", "copper", "gap-flow-copper-intermediate-stages"],
    ["741012", "copper", "gap-flow-copper-intermediate-stages"],
    ["760711", "aluminum", "gap-flow-aluminum-intermediate-stages"],
    ["760719", "aluminum", "gap-flow-aluminum-intermediate-stages"],
    ["382499", "cathode-material", "gap-flow-cathode-cell-bilateral"],
    ["380110", "anode-material", "gap-flow-anode-cell-bilateral"],
    ["380190", "anode-material", "gap-flow-anode-cell-bilateral"]
  ])("resolves China to Korea HS %s evidence within its narrow scope", async (code, itemId, gapId) => {
    const { fixture, queries } = await loadContext();
    const evidenceId = `evidence-comtrade-intermediate-chn-kor-intermediate-${code}-export`;
    const evidence = fixture?.evidence.find((record) => record.id === evidenceId);

    expect(evidence?.supportType).toBe("bilateral_flow");
    expect(evidence?.scope.fromEntityId).toBe("country-cn");
    expect(evidence?.scope.toEntityId).toBe("country-kr");
    expect(evidence?.scope.direction).toBe("export");
    expect(evidence?.scope.period.label).toBe("2023");
    expect(evidence?.scope.itemIds).toContain(itemId);
    expect(evidence?.scope.classificationCodes).toContainEqual(expect.objectContaining({
      system: "HS",
      version: "2022",
      code
    }));
    expect(evidence?.scope.limitations.join(" ")).toContain("smartphone end use");
    expect(evidence?.scope.supportsBilateralFlow).toBe(true);
    expect(evidence?.scope.supportsCountryRole).toBe(false);

    const observation = queries.getMaterialTradeObservations(productId, {
      materialItemId: itemId,
      reporterEntityId: "country-cn",
      partnerScope: "entity",
      flow: "export"
    }).find(({ observation: candidate }) =>
      candidate.partnerEntityId === "country-kr" && candidate.classificationCode === code
    );
    expect(observation?.evidenceLevel.code).toBe("bilateral_supported");
    expect(observation?.relatedEvidenceGaps.some(({ gap }) => gap.gapId === gapId)).toBe(true);
  });

  it("keeps broad classifications from proving battery grade, cell input or smartphone use", async () => {
    const { fixture } = await loadContext();
    const gapById = new Map(fixture?.evidenceGaps.map((gap) => [gap.gapId, gap]));

    expect(gapById.get("gap-flow-cathode-cell-bilateral")?.missingEvidence).toContain("不能识别");
    expect(gapById.get("gap-flow-anode-cell-bilateral")?.missingEvidence).toContain("不能识别");
    expect(gapById.get("gap-flow-copper-intermediate-stages")?.missingEvidence).toContain("连续转换");
    expect(gapById.get("gap-flow-aluminum-intermediate-stages")?.missingEvidence).toContain("连续转换");
  });
});
