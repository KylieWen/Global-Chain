import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

describe("phase 11 material role-pair coverage", () => {
  it("publishes selected country-role pairs without upgrading the route", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
    const queries = createProductQueryService(repository);
    const observations = queries.getMaterialTradeObservations("generic-smartphone", { partnerScope: "entity" });
    const pairs = new Set(observations.filter(({ observation }) => observation.observationId.startsWith("material-role-")).map(({ observation }) => `${observation.reporterEntityId}:${observation.partnerEntityId}:${observation.materialItemId}`));
    expect(pairs).toEqual(new Set([
      "country-au:country-cn:aluminum", "country-au:country-cn:lithium", "country-cd:country-cn:cobalt",
      "country-id:country-cn:nickel", "country-cl:country-cn:copper", "country-cn:country-kr:graphite"
    ]));
    const story = queries.getSupplyChainStory("generic-smartphone");
    expect(story?.flows.every(({ flow }) => flow.evidenceLevel === "representative" && flow.value === null && flow.quantity === null)).toBe(true);
  });

  it("records missing directional rows as absence, not zero", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
    const queries = createProductQueryService(repository);
    const cobalt = queries.getMaterialTradeObservations("generic-smartphone", { materialItemId: "cobalt", reporterEntityId: "country-cd", partnerScope: "entity" });
    expect(cobalt.length).toBe(1);
    expect(cobalt[0].observation.flow).toBe("export");
    expect(cobalt[0].observation.value).not.toBe(0);
  });

  it("links partial gaps to the new bilateral evidence records", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
    const queries = createProductQueryService(repository);
    const provenance = queries.getProvenance("generic-smartphone");
    const ids = new Set(provenance?.evidence.map(({ id }) => id));
    for (const gapId of ["gap-flow-lithium-bilateral-customs", "gap-flow-cobalt-bilateral-customs", "gap-flow-nickel-bilateral-customs"]) {
      const gap = provenance?.evidenceGaps.find(({ gap }) => gap.gapId === gapId)?.gap;
      expect(gap?.status).toBe("partial");
      expect(gap?.evidenceIds.every((id) => ids.has(id))).toBe(true);
    }
  });
});
