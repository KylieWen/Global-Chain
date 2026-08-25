import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";
import { contextMismatch, contextQuery } from "../apps/web/lib/context";
import { ledgerPath, materialObservationPath, nodePath, supplyChainPath } from "../apps/web/lib/paths";

describe("phase 16 research context and route availability", () => {
  it("encodes and preserves the cross-module context", () => {
    const context = { period: "2023", datasetVersion: "globe-chain-smartphone-2023.4", contentVersion: "smartphone-route-2023.2" };
    expect(contextQuery(context)).toContain("period=2023");
    expect(supplyChainPath("generic-smartphone", "battery", context)).toContain("focus=battery");
    expect(nodePath("generic-smartphone", "node-cn-assembly", context)).toContain("datasetVersion=globe-chain-smartphone-2023.4");
    expect(ledgerPath("generic-smartphone", "country-cn", context)).toContain("contentVersion=smartphone-route-2023.2");
    expect(materialObservationPath("generic-smartphone", "obs-1", context)).toContain("period=2023");
  });

  it("reports mismatched historical context without changing the active release", () => {
    expect(contextMismatch({ period: "2022", datasetVersion: "old", contentVersion: "old-route" }, { period: "2023", datasetVersion: "active", contentVersion: "active-route" })).toHaveLength(3);
    expect(contextMismatch({ period: "2023", datasetVersion: "active" }, { period: "2023", datasetVersion: "active", contentVersion: "active-route" })).toEqual([]);
  });

  it("distinguishes published component routes from empty states", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json"));
    const queries = createProductQueryService(repository);
    const overview = queries.getProductOverview("generic-smartphone")!;
    const availability = new Map(overview.directChildren.map((item) => {
      const story = queries.getSupplyChainStory("generic-smartphone", { focusItemId: item.id });
      return [item.id, Boolean(story && (story.nodes.length > 0 || story.flows.length > 0))];
    }));
    expect(availability.get("battery")).toBe(true);
    expect(availability.get("display")).toBe(true);
    expect(["processor-memory", "camera", "pcb-connector", "enclosure-structure", "sensor-audio"].every((id) => availability.get(id) === false)).toBe(true);
  });

  it("keeps representative routes and sample fixtures unchanged", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json"));
    const story = createProductQueryService(repository).getSupplyChainStory("generic-smartphone");
    expect(story?.flows.every(({ flow }) => flow.evidenceLevel === "representative" && flow.quantity === null)).toBe(true);
    const sample = await loadFixtureRepositoryFromManifest(resolve("data/samples/manifest.json"), { allowedStatuses: ["draft", "published"] });
    expect(sample.listProductIds()).toEqual(["generic-smartphone", "coffee"]);
  });
});
