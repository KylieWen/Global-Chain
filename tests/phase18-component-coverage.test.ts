import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

describe("phase 18 smartphone component data coverage", () => {
  it("returns a generic component coverage matrix from the domain layer", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
    const overview = createProductQueryService(repository).getProductOverview("generic-smartphone");
    const coverage = new Map(overview?.componentCoverage.map((entry) => [entry.item.id, entry]));

    expect(coverage.get("battery")?.status).toBe("route_published");
    expect(coverage.get("battery")?.nodeCount).toBeGreaterThan(0);
    expect(coverage.get("display")?.status).toBe("route_published");
    expect(coverage.get("processor-memory")?.status).toBe("partial_route");
    expect(coverage.get("processor-memory")?.nodeCount).toBe(3);
    expect(coverage.get("processor-memory")?.flowCount).toBe(0);
    expect(coverage.get("camera")?.status).toBe("partial_route");
  });

  it("does not turn catalog-only components into unsupported route claims", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
    const overview = createProductQueryService(repository).getProductOverview("generic-smartphone");
    const evidencePending = overview?.componentCoverage.filter((entry) => ["camera", "pcb-connector", "enclosure-structure", "sensor-audio"].includes(entry.item.id)) ?? [];
    expect(evidencePending).toHaveLength(4);
    expect(evidencePending.every((entry) => entry.status === "partial_route" && entry.flowCount === 0)).toBe(true);
  });

  it("summarizes role evidence separately from bilateral and representative flows", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
    const queries = createProductQueryService(repository);
    const fullStory = queries.getSupplyChainStory("generic-smartphone");
    const processorStory = queries.getSupplyChainStory("generic-smartphone", { focusItemId: "processor-memory" });

    expect(fullStory?.interpretationSummary.mode).toBe("route");
    expect(fullStory?.interpretationSummary.items.find(({ code }) => code === "country_roles")?.count).toBeGreaterThan(0);
    expect(fullStory?.interpretationSummary.items.find(({ code }) => code === "direct_bilateral_flows")?.count).toBe(0);
    expect(fullStory?.interpretationSummary.items.find(({ code }) => code === "representative_connections")?.count).toBeGreaterThan(0);
    expect(processorStory?.interpretationSummary.mode).toBe("evidence_only");
    expect(processorStory?.flows).toHaveLength(0);
    expect(processorStory?.interpretationSummary.items.find(({ code }) => code === "country_roles")?.count).toBe(3);
  });
});
