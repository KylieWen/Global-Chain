import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ProductFixtureSchema } from "@globe-chain/contracts";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

describe("phase 30 manufacturing process, equipment and manufacturer capabilities", () => {
  it("publishes a reusable process chain with equipment requirements", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json"));
    const queries = createProductQueryService(repository);
    const view = queries.getManufacturingProcessChain("generic-smartphone", "process-chain-semiconductor-packaging");

    expect(view?.steps).toHaveLength(18);
    expect(view?.steps.map(({ step }) => step.name)).toEqual(expect.arrayContaining([
      "晶圆减薄", "晶圆切割", "固晶 / Die Attach", "引线键合", "塑封 / Encapsulation", "电性能测试"
    ]));
    expect(view?.steps.every(({ requirements }) => requirements.some(({ requirement }) => requirement.requirementType === "equipment"))).toBe(true);
    expect(view?.organizations).toHaveLength(6);
    expect(view?.componentItem?.id).toBe("processor-memory");
  });

  it("keeps manufacturer capability separate from customer supply relationships", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json"));
    const view = createProductQueryService(repository).getManufacturingProcessChain("generic-smartphone", "process-chain-semiconductor-packaging");
    const capabilities = view?.steps.flatMap(({ requirements }) => requirements.flatMap((requirement) => requirement.capabilities)) ?? [];

    expect(capabilities).toHaveLength(9);
    expect(capabilities.every(({ capability }) => capability.capabilityEvidenceLevel === "manufacturer_supported")).toBe(true);
    expect(capabilities.every(({ capability }) => capability.commercialRelationshipClaimed === false && capability.customerOrganizationId === null)).toBe(true);
    expect(capabilities.every(({ evidence }) => evidence.some(({ evidence: record }) => record.supportType === "manufacturer_capability"))).toBe(true);
    expect(capabilities.every(({ relationshipDescription }) => relationshipDescription.includes("不证明"))).toBe(true);
  });

  it("retains an explicit evidence gap when no manufacturer has been verified", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json"));
    const view = createProductQueryService(repository).getManufacturingProcessChain("generic-smartphone", "process-chain-semiconductor-packaging");
    const plating = view?.steps.find(({ step }) => step.id === "process-plating-marking");

    expect(plating?.requirements[0]?.equipmentCategory?.id).toBe("equipment-plating-marking-line");
    expect(plating?.requirements[0]?.capabilities).toHaveLength(0);
  });

  it("keeps mock fixtures untouched and validates the new published fixture", () => {
    const activeManifest = JSON.parse(readFileSync(resolve("data/published/manifest.json"), "utf8"));
    const fixturePath = resolve("data/published", activeManifest.fixtures[0].path);
    expect(ProductFixtureSchema.parse(JSON.parse(readFileSync(fixturePath, "utf8"))).datasetVersion.version).toBe("globe-chain-smartphone-2023.16");
    expect(readFileSync(resolve("data/samples/smartphone/fixture.json"), "utf8")).not.toContain("process-chain-semiconductor-packaging");
  });
});
