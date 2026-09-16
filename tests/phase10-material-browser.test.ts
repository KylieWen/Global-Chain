import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

const loadQueries = async () => createProductQueryService(await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json")));

describe("phase 10 material observation browser queries", () => {
  it("filters without coupling observations to the smartphone route", async () => {
    const queries = await loadQueries();
    const copper = queries.getMaterialTradeObservations("generic-smartphone", { materialItemId: "copper", partnerScope: "entity", flow: "export" });
    expect(copper.length).toBeGreaterThan(0);
    expect(copper.every(({ observation }) => observation.materialItemId === "copper" && observation.partnerCode !== 0 && observation.flow === "export")).toBe(true);
    const story = queries.getSupplyChainStory("generic-smartphone");
    expect(story?.flows.every(({ flow }) => flow.evidenceLevel === "representative" && flow.quantity === null)).toBe(true);
  });

  it("resolves sources, evidence levels and matching gap boundaries", async () => {
    const queries = await loadQueries();
    const observations = queries.getMaterialTradeObservations("generic-smartphone");
    const copper = observations.find(({ observation }) => observation.materialItemId === "copper" && observation.partnerScope === "entity");
    expect(copper?.source?.id).toBe("source-un-comtrade-refresh-20260916");
    expect(new URL(String(copper?.observation.quality.requestUrl)).searchParams.get("cmdCode")?.split(",")).toContain("7403");
    expect(copper?.observation.quality.rawResponseSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(copper?.evidenceLevel.code).toBe("bilateral_supported");
    expect(copper?.relatedEvidenceGaps.some(({ gap }) => gap.gapId === "gap-flow-copper-intermediate-stages")).toBe(true);
    expect(queries.getMaterialTradeObservation("generic-smartphone", copper!.observation.observationId)?.observation).toEqual(copper?.observation);
  });

  it("keeps world totals and specific partners independently filterable", async () => {
    const queries = await loadQueries();
    const world = queries.getMaterialTradeObservations("generic-smartphone", { partnerScope: "world_total" });
    const bilateral = queries.getMaterialTradeObservations("generic-smartphone", { partnerScope: "entity" });
    expect(world.every(({ observation }) => observation.partnerCode === 0 && observation.partnerEntityId === null)).toBe(true);
    expect(bilateral.every(({ observation }) => observation.partnerCode !== 0 && observation.partnerEntityId !== null)).toBe(true);
  });
});
