import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

describe("phase 20 semiconductor classification boundaries", () => {
  it("publishes reusable processor and memory classification candidates without end-use claims", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json"));
    const overview = createProductQueryService(repository).getProductOverview("generic-smartphone");
    const processor = overview?.componentCoverage.find(({ item }) => item.id === "processor-memory");
    expect(processor?.classificationMappings.some(({ classification }) => classification.code === "854231")).toBe(true);
    expect(processor?.classificationMappings.every(({ supportsEndUse, mappingType }) => !supportsEndUse || mappingType === "exact")).toBe(true);
  });

  it("keeps the previous immutable release readable", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2023.6/manifest.json"));
    const overview = createProductQueryService(repository).getProductOverview("generic-smartphone");
    expect(overview?.datasetVersion.version).toBe("globe-chain-smartphone-2023.6");
  });
});
