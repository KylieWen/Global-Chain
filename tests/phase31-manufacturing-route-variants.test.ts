import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

describe("phase 31 manufacturing route variants and coverage gaps", () => {
  it("separates wire-bond and flip-chip route variants", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
    const view = createProductQueryService(repository).getManufacturingProcessChain("generic-smartphone", "process-chain-semiconductor-packaging");

    expect(view?.routeVariants.map(({ id }) => id)).toEqual(["route-variant-wire-bond", "route-variant-flip-chip"]);
    expect(view?.routeVariants.every(({ stepIds }) => stepIds.length === 15)).toBe(true);
    expect(view?.steps.find(({ step }) => step.id === "process-wire-bonding")?.routeVariants.map(({ id }) => id)).toEqual(["route-variant-wire-bond"]);
    expect(view?.steps.find(({ step }) => step.id === "process-flip-chip-attach")?.routeVariants.map(({ id }) => id)).toEqual(["route-variant-flip-chip"]);
  });

  it("keeps every process equipped while exposing manufacturer evidence gaps", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
    const view = createProductQueryService(repository).getManufacturingProcessChain("generic-smartphone", "process-chain-semiconductor-packaging");
    const equipmentRequirements = view?.steps.flatMap(({ requirements }) => requirements) ?? [];

    expect(equipmentRequirements).toHaveLength(26);
    expect(equipmentRequirements.filter(({ requirement }) => requirement.requirementType === "equipment")).toHaveLength(18);
    expect(equipmentRequirements.filter(({ requirement }) => requirement.requirementType !== "equipment")).toHaveLength(8);
    expect(equipmentRequirements.filter(({ requirement }) => requirement.requirementType === "equipment").every(({ equipmentCategory }) => equipmentCategory !== null)).toBe(true);
    expect(equipmentRequirements.filter(({ capabilities }) => capabilities.length > 0)).toHaveLength(9);
    expect(equipmentRequirements.filter(({ capabilities }) => capabilities.length === 0)).toHaveLength(17);
  });

  it("records the chain boundary without inventing intermediate material lineage", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
    const view = createProductQueryService(repository).getManufacturingProcessChain("generic-smartphone", "process-chain-semiconductor-packaging");

    expect(view?.steps[0]?.step.inputItemIds).toEqual(["semiconductor-wafer"]);
    expect(view?.steps.at(-1)?.step.outputItemIds).toEqual(["chip-packaging"]);
    expect(view?.steps.slice(1, -1).every(({ step }) => step.inputItemIds.length === 0 && step.outputItemIds.length === 0)).toBe(true);
  });

  it("resolves process inputs and outputs for presentation without page-side ID lookups", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json"));
    const view = createProductQueryService(repository).getManufacturingProcessChain("generic-smartphone", "process-chain-semiconductor-packaging");

    expect(view?.steps[0]?.inputItems.map(({ id }) => id)).toEqual(["semiconductor-wafer"]);
    expect(view?.steps.at(-1)?.outputItems.map(({ id }) => id)).toEqual(["chip-packaging"]);
    expect(view?.steps.slice(1, -1).every(({ inputItems, outputItems }) => inputItems.length === 0 && outputItems.length === 0)).toBe(true);
  });
});
