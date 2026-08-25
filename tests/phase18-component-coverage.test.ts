import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

describe("phase 18 smartphone component data coverage", () => {
  it("returns a generic component coverage matrix from the domain layer", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json"));
    const overview = createProductQueryService(repository).getProductOverview("generic-smartphone");
    const coverage = new Map(overview?.componentCoverage.map((entry) => [entry.item.id, entry]));

    expect(coverage.get("battery")?.status).toBe("route_published");
    expect(coverage.get("battery")?.nodeCount).toBeGreaterThan(0);
    expect(coverage.get("display")?.status).toBe("route_published");
    expect(coverage.get("processor-memory")?.status).toBe("catalog_only");
    expect(coverage.get("camera")?.status).toBe("catalog_only");
  });

  it("does not turn catalog-only components into unsupported route claims", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json"));
    const overview = createProductQueryService(repository).getProductOverview("generic-smartphone");
    const catalogOnly = overview?.componentCoverage.filter((entry) => entry.status === "catalog_only") ?? [];
    expect(catalogOnly.length).toBeGreaterThan(0);
    expect(catalogOnly.every((entry) => entry.nodeCount === 0 && entry.flowCount === 0 && entry.evidenceLevels.length === 0)).toBe(true);
  });
});
