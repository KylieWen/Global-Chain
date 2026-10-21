import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import publishedSmartphone from "../data/published/smartphone/fixture.json";
import {
  FixtureLoaderError,
  loadFixtureRepositoryFromManifest,
  parseProductFixture
} from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

const publishedManifestPath = resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json");

async function loadPublishedQueries() {
  const repository = await loadFixtureRepositoryFromManifest(publishedManifestPath, {
    allowedStatuses: ["published"]
  });
  return createProductQueryService(repository);
}

describe("phase 8 evidence gap registry", () => {
  it("separates specific partners from partnerCode=0 world totals", async () => {
    const queries = await loadPublishedQueries();
    const ledger = queries.getCountryLedger("generic-smartphone", "country-cn", {
      label: "2024",
      itemId: "generic-smartphone"
    });
    expect(ledger?.resolvedTradeObservations.filter((row) => row.partnerScope === "world_total")).toHaveLength(2);
    expect(ledger?.resolvedTradeObservations.filter((row) => row.partnerScope === "entity")).toHaveLength(4);
    expect(ledger?.resolvedTradeObservations.filter((row) => row.partnerScope === "world_total").every((row) => row.observation.partnerCode === 0 && row.partner === null)).toBe(true);
    expect(ledger?.resolvedTradeObservations.filter((row) => row.partnerScope === "entity").every((row) => (row.observation.partnerCode ?? 0) > 0 && row.partner !== null)).toBe(true);
  });

  it("does not combine two world totals into a bilateral fact and keeps mirror reports independent", async () => {
    const fixture = publishedSmartphone as typeof publishedSmartphone;
    const world = fixture.tradeObservations.filter((row) => row.partnerScope === "world_total");
    const bilateral = fixture.tradeObservations.filter((row) => row.partnerScope === "entity");
    expect(world.some((row) => row.reporterEntityId === "country-cn" && row.direction === "export")).toBe(true);
    expect(world.some((row) => row.reporterEntityId === "country-us" && row.direction === "import")).toBe(true);
    expect(bilateral.some((row) => row.reporterCode === 156 && row.partnerCode === 842 && row.direction === "export")).toBe(true);
    expect(bilateral.some((row) => row.reporterCode === 842 && row.partnerCode === 156 && row.direction === "import")).toBe(true);
    expect(new Set(bilateral.map((row) => row.id)).size).toBe(bilateral.length);
    expect(bilateral.every((row) => row.quality?.isReported !== undefined)).toBe(true);
  });

  it("keeps role evidence from upgrading adjacent representative edges", async () => {
    const queries = await loadPublishedQueries();
    const story = queries.getSupplyChainStory("generic-smartphone", { label: "2023" });
    expect(story?.nodes.find((node) => node.node.id === "node-kr-cell")?.evidenceLevel.code).toBe("role_supported");
    expect(story?.nodes.find((node) => node.node.id === "node-jp-components")?.evidenceLevel.code).toBe("role_supported");
    expect(story?.flows.every((flow) => flow.evidenceLevel.code === "representative")).toBe(true);
    expect(story?.flows.some((flow) => flow.evidence.some((evidence) => evidence.evidence.supportType === "bilateral_flow"))).toBe(false);
  });

  it("does not treat aggregate HS candidates as smartphone end-use evidence", () => {
    const aggregateCandidates = publishedSmartphone.evidenceGaps
      .flatMap((gap) => gap.classificationCandidates)
      .filter((candidate) => candidate.mappingType !== "exact");
    expect(aggregateCandidates.length).toBeGreaterThan(0);
    expect(aggregateCandidates.every((candidate) => (candidate.supportsEndUse ?? false) === false)).toBe(true);
  });

  it("publishes all four gap states and preserves unknown versus true zero", async () => {
    const queries = await loadPublishedQueries();
    const gaps = queries.getEvidenceGaps("generic-smartphone");
    expect(new Set(gaps.map((view) => view.gap.status))).toEqual(
      new Set(["open", "partial", "closed", "not_publicly_observable"])
    );
    const story = queries.getSupplyChainStory("generic-smartphone", { label: "2023" });
    expect(story?.flows.every((flow) => flow.flow.quantity === null && flow.quantityDataStatus === "unknown")).toBe(true);
    const zero = structuredClone(publishedSmartphone) as Record<string, unknown> & {
      tradeObservations: Array<Record<string, unknown>>;
    };
    zero.tradeObservations.push({
      ...zero.tradeObservations[0],
      id: "trade-phase8-true-zero",
      value: 0,
      dataStatus: "observed",
      valueDataStatus: "observed"
    });
    const parsed = parseProductFixture(zero);
    expect(parsed.tradeObservations.find((row) => row.id === "trade-phase8-true-zero")?.value).toBe(0);
    const unknownFixture = structuredClone(publishedSmartphone) as Record<string, unknown> & {
      tradeObservations: Array<Record<string, unknown>>;
    };
    unknownFixture.tradeObservations[0].value = null;
    unknownFixture.tradeObservations[0].valueDataStatus = "unknown";
    unknownFixture.tradeObservations[0].dataStatus = "unknown";
    const unknownParsed = parseProductFixture(unknownFixture);
    const unknown = unknownParsed.tradeObservations.find((row) => row.value === null);
    expect(unknown?.dataStatus).toBe("unknown");
  });

  it("requires bilateral scope endpoints and matches story-node endpoints to country IDs", () => {
    const valid = structuredClone(publishedSmartphone) as Record<string, unknown> & {
      storyGraph: { flows: Array<Record<string, unknown>> };
      evidence: Array<Record<string, any>>;
    };
    const flow = valid.storyGraph.flows.find((candidate) => candidate.id === "flow-assembly-export");
    if (!flow) throw new Error("Expected assembly export flow");
    flow.evidenceLevel = "bilateral_supported";
    flow.evidenceIds = ["evidence-comtrade-china-united-states-smartphone-bilateral-export-2023"];
    flow.sourceIds = ["source-un-comtrade"];
    const parsed = parseProductFixture(valid);
    expect(parsed.storyGraph.flows.find((candidate) => candidate.id === flow.id)?.evidenceLevel).toBe("bilateral_supported");

    const invalid = structuredClone(valid);
    const evidence = invalid.evidence.find((record) => record.id === flow.evidenceIds[0]);
    if (!evidence?.scope) throw new Error("Expected bilateral scope");
    evidence.scope.toEntityId = "country-de";
    expect(() => parseProductFixture(invalid)).toThrow(FixtureLoaderError);
  });

  it("keeps the registry/query contract reusable for a future product fixture", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/samples/manifest.json"), {
      allowedStatuses: ["draft"]
    });
    const queries = createProductQueryService(repository);
    expect(queries.getSupplyChainStory("coffee")?.product.id).toBe("coffee");
    expect(queries.getEvidenceGaps("coffee")).toEqual([]);
  });
});
