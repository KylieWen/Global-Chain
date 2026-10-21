import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

describe("phase 12 intermediate material classifications", () => {
  it("publishes foil and electrode candidates with explicit mapping limits", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
    const fixture = repository.getProductFixture("generic-smartphone");
    const codes = new Set(fixture?.classificationCodes.map((code) => code.code));
    expect(["741011", "741012", "760711", "760719", "382499", "380110", "380190"].every((code) => codes.has(code))).toBe(true);
    const observations = createProductQueryService(repository).getMaterialTradeObservations("generic-smartphone", { classificationMappingType: "approximate" });
    expect(observations.some(({ observation }) => observation.classificationCode === "741011")).toBe(true);
    expect(observations.every(({ observation }) => observation.limitation.includes("不证明材料进入手机"))).toBe(true);
  });

  it("does not promote intermediate observations to smartphone route claims", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
    const queries = createProductQueryService(repository);
    const intermediate = queries.getMaterialTradeObservations("generic-smartphone", { materialItemId: "cathode-material" });
    expect(intermediate.length).toBeGreaterThan(0);
    expect(intermediate.every(({ evidenceLevel }) => evidenceLevel.code === "bilateral_supported")).toBe(true);
    expect(queries.getSupplyChainStory("generic-smartphone")?.flows.every(({ flow }) => flow.evidenceLevel === "representative")).toBe(true);
  });
});
