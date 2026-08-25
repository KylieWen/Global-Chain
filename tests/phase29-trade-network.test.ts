import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

describe("phase 29 bilateral trade network", () => {
  it("returns only concrete partner observations", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json"));
    const network = createProductQueryService(repository).getTradeNetwork("generic-smartphone");
    expect(network?.observations.length).toBe(8);
    expect(network?.observations.every(({ observation }) => observation.partnerScope === "entity" && observation.partnerEntityId)).toBe(true);
    expect(network?.warnings.some((warning) => warning.includes("partnerCode=0"))).toBe(true);
  });
});
