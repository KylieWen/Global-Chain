import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ProductFixtureSchema } from "@globe-chain/contracts";
import { loadFixtureRepositoryFromManifest, parseProductFixture } from "@globe-chain/db";
import { createInMemoryFixtureRepository, createProductQueryService } from "@globe-chain/domain";
import raw from "../data/raw/soybean-oil-2026-10-21/comtrade-china-soy-2024.json";

async function build() {
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", "import{buildSoybeanOil}from'./scripts/build-soybean-oil.mjs';process.stdout.write(JSON.stringify(await buildSoybeanOil()));"], { cwd: resolve("."), encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }));
}
function queriesFor(fixture: unknown) { return createProductQueryService(createInMemoryFixtureRepository([parseProductFixture(fixture)])); }

describe("independent soybean edible oil candidate", () => {
  it("rebuilds deterministic bytes and loads from a fresh temporary directory with the full published contract", async () => {
    const first = await build(), second = await build();
    expect(first.files).toEqual(second.files);
    const contract = ProductFixtureSchema.safeParse(first.fixture);
    expect(contract.success, contract.success ? "" : JSON.stringify(contract.error.issues)).toBe(true);
    const directory = await mkdtemp(resolve(tmpdir(), "globe-chain-soy-oil-"));
    try {
      for (const [name, bytes] of Object.entries(first.files)) await writeFile(resolve(directory, name), bytes as string);
      const repository = await loadFixtureRepositoryFromManifest(resolve(directory, "manifest.json"));
      expect(repository.listProductIds()).toEqual(["generic-soybean-oil"]);
      expect(repository.getProductFixture("generic-soybean-oil")!.datasetVersion.version).toBe("globe-chain-soybean-oil-2026.1");
    } finally { await rm(directory, { recursive: true, force: true }); }
    expect(first.audit.sources).toHaveLength(8);
  });

  it("preserves every official trade value, quantity, partner and flag exactly without missing rows becoming zero", async () => {
    const { fixture } = await build();
    const records = [...fixture.tradeObservations, ...fixture.materialTradeObservations];
    expect(fixture.tradeObservations).toHaveLength(4);
    expect(fixture.materialTradeObservations).toHaveLength(13);
    expect(records).toHaveLength(raw.data.length);
    const seen = new Set();
    for (const record of records) {
      const flow = record.flowCode ?? (record.flow === "import" ? "M" : "X");
      const row = raw.data.find((row) => row.cmdCode === record.classificationCode && row.flowCode === flow && row.partnerCode === record.partnerCode)!;
      expect(row).toBeTruthy();
      const key = `${record.classificationCode}-${flow}-${record.partnerCode}`;
      expect(seen.has(key)).toBe(false); seen.add(key);
      expect(record.value).toBe(row.primaryValue);
      expect(record.quantity).toBe(row.qty);
      expect(record.quantityDataStatus).toBe(row.isQtyEstimated ? "estimated" : "observed");
      expect(record.quality.isReported).toBe(row.isReported);
      expect(record.unit).toBe("kg");
      expect(record.classificationVersion).toBe("2022");
      expect(record.period.label).toBe("2024");
      expect(record.partnerScope).toBe(row.partnerCode === 0 ? "world_total" : "entity");
      if (row.partnerCode === 0) expect(record.partnerEntityId).toBeNull();
      if (row.partnerCode === 842) expect(record.partnerEntityId).toBe("country-us");
    }
    const brazilSoy = fixture.materialTradeObservations.find((row) => row.classificationCode === "120190" && row.partnerCode === 76 && row.flow === "import");
    expect(brazilSoy.quantity).toBe(74647380000);
    expect(brazilSoy.value).toBe(36455784699);
    expect(fixture.tradeObservations.every((row) => row.classificationCode === "150790" && row.itemId === fixture.productId)).toBe(true);
  });

  it("connects all three origins to the Chinese food product and retains distinct local and co-product branches", async () => {
    const { fixture } = await build();
    const reached = (start: string) => {
      const seen = new Set([start]);
      for (let index = 0; index < fixture.storyGraph.nodes.length; index++) for (const flow of fixture.storyGraph.flows) if (seen.has(flow.fromEntityId)) seen.add(flow.toEntityId);
      return seen;
    };
    for (const start of ["br-soybean", "us-soybean", "cn-soybean", "cn-packaging"]) expect(reached(`node-soy-${start}`).has("node-soy-cn-market"), start).toBe(true);
    expect(reached("node-soy-br-soybean").has("node-soy-br-crush")).toBe(true);
    expect(reached("node-soy-us-soybean").has("node-soy-us-refine")).toBe(true);
    expect(reached("node-soy-cn-crush").has("node-soy-cn-meal")).toBe(true);
    expect(fixture.storyGraph.nodes).toHaveLength(13);
    expect(fixture.storyGraph.flows).toHaveLength(13);
    expect(fixture.storyGraph.flows.every((flow) => flow.evidenceLevel === "representative" && flow.value === null && flow.quantity === null && flow.quantityDataStatus === "unknown")).toBe(true);
  });

  it("provides process inputs, outputs and equipment while retaining the historical technical reference year", async () => {
    const { fixture } = await build();
    expect(fixture.manufacturingProcessChains).toHaveLength(3);
    expect(fixture.manufacturingProcessSteps).toHaveLength(9);
    expect(fixture.equipmentCategories).toHaveLength(8);
    for (const step of fixture.manufacturingProcessSteps) {
      expect(step.inputItemIds.length).toBeGreaterThan(0);
      expect(step.outputItemIds.length).toBeGreaterThan(0);
      expect(step.evidenceIds.length).toBeGreaterThan(0);
      expect(step.period.label).toBe(step.processChainId === "process-chain-soy-packaging" ? "2026-10" : "1995");
    }
    const extraction = fixture.manufacturingProcessSteps.find((step) => step.id === "process-soy-crushing-extraction");
    expect(extraction.outputItemIds).toEqual(["oil-miscella", "defatted-flakes"]);
    const recovery = fixture.manufacturingProcessSteps.find((step) => step.id === "process-soy-crushing-recovery");
    expect(recovery.outputItemIds).toEqual(["crude-soybean-oil", "hexane-solvent"]);
    expect(fixture.items.find((item) => item.id === "hexane-solvent").description).toContain("不是食用油配料");
    expect(fixture.organizationCapabilities).toHaveLength(0);
  });

  it("exposes finished oil, feedstock and coproduct statistics through the existing generic queries", async () => {
    const { fixture } = await build(); const queries = queriesFor(fixture);
    const product = queries.getProductOverview(fixture.productId)!;
    expect(product.product.name).toBe("大豆食用油");
    expect(queries.getTradeMapView(fixture.productId)!.observations).toHaveLength(4);
    expect(queries.getTradeMapView(fixture.productId, { focusItemId: "soybean" })!.observations).toHaveLength(5);
    expect(queries.getTradeMapView(fixture.productId, { focusItemId: "crude-soybean-oil" })!.observations).toHaveLength(4);
    expect(queries.getTradeMapView(fixture.productId, { focusItemId: "soybean-meal" })!.observations).toHaveLength(4);
    expect(queries.getTradeNetwork(fixture.productId)!.observations).toHaveLength(2);
    expect(queries.getSupplyChainStory(fixture.productId)!.nodes).toHaveLength(13);
    const china = queries.getCountryLedger(fixture.productId, "country-cn")!;
    expect(china.resolvedTradeObservations).toHaveLength(4);
    expect(china.resolvedMacroIndicators).toHaveLength(1);
    expect(china.resolvedMacroIndicators[0].measurement.kind).toBe("quantity");
    expect(china.resolvedMacroIndicators[0].measurement.value).toBe(18810000000);
    expect(queries.getManufacturingProcessChain(fixture.productId, "process-chain-soy-refining")!.steps).toHaveLength(4);
  });

  it("keeps annual customs and country-specific USDA marketing estimates separate, with no fake currencies", async () => {
    const { fixture } = await build();
    expect(fixture.macroIndicators).toHaveLength(2);
    for (const record of fixture.macroIndicators) {
      expect(record.value).toBeNull(); expect(record.currency).toBeNull();
      expect(record.unit).toBe("kg"); expect(record.method).toBe("estimated"); expect(record.dataStatus).toBe("estimated");
    }
    expect(fixture.macroIndicators[0].period.start).toBe("2023-10-01");
    expect(fixture.macroIndicators[1].period.start).toBe("2024-01-01");
    expect(fixture.macroIndicators[1].quantity).toBe(11341000000);
    const china = await readFile(resolve("data/raw/soybean-oil-2026-10-21/usda-china-CH2025-0055.txt"), "utf8");
    expect(china).toContain("Production 18810 17452");
    const brazil = await readFile(resolve("data/raw/soybean-oil-2026-10-21/usda-brazil-BR2025-0017.txt"), "utf8");
    expect(brazil).toContain("Production (1000 MT)  11341 11341");
    expect(fixture.classificationCodes.find((code) => code.code === "150790").label).toContain("含其他用途");
  });

  it("rejects unsupported bilateral promotion and a numeric zero mislabeled unknown", async () => {
    const { fixture } = await build();
    const unsupported = structuredClone(fixture);
    unsupported.storyGraph.flows[0].evidenceLevel = "bilateral_supported";
    expect(() => parseProductFixture(unsupported)).toThrow();
    const falseZero = structuredClone(fixture);
    falseZero.storyGraph.flows[0].quantity = 0;
    expect(() => parseProductFixture(falseZero)).toThrow();
  });

  it("contains only independent soybean content and no inherited mock or smartphone data", async () => {
    const { fixture } = await build();
    expect(JSON.stringify(fixture)).not.toMatch(/generic-smartphone|battery-module|source-synthetic|\"method\":\"mock\"/);
    expect(fixture.items.map((item) => item.id)).toContain("generic-soybean-oil");
    expect(fixture.entities).toHaveLength(3);
    expect(fixture.tradeGuides).toHaveLength(0);
    expect(fixture.warnings).toHaveLength(0);
    expect(fixture.evidenceGaps[0].status).toBe("not_publicly_observable");
  });
});
