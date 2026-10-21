import { createHash } from "node:crypto";
import { readFile, mkdtemp, mkdir, cp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ProductFixtureSchema, type ProductFixture } from "@globe-chain/contracts";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createInMemoryFixtureRepository, createProductQueryService, type ProductQueryService } from "@globe-chain/domain";
import { buildCottonTshirt, cottonContentPath, cottonReviewPath } from "../scripts/build-cotton-tshirt.mjs";
import { createMapView } from "../apps/web/lib/map-view-model";

const productId = "generic-cotton-tshirt";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

describe("cotton T-shirt independent release", () => {
  let built: Awaited<ReturnType<typeof buildCottonTshirt>>;
  let fixture: ProductFixture;
  let queries: ProductQueryService;

  beforeAll(async () => {
    built = await buildCottonTshirt();
    fixture = ProductFixtureSchema.parse(built.fixture);
    queries = createProductQueryService(createInMemoryFixtureRepository([fixture]));
  });

  it("passes published contracts and exposes breakdown, branches and process through generic queries", () => {
    expect(fixture.datasetVersion.status).toBe("published");
    expect(fixture.items).toHaveLength(17);
    expect(queries.getProductOverview(productId)?.directChildren.map(item => item.id)).toEqual(["tshirt-body-panels", "tshirt-sleeve-panels", "tshirt-neck-trim", "tshirt-sewing-thread"]);
    const body = queries.getProductOverview(productId)!.componentCoverage.find(entry => entry.item.id === "tshirt-body-panels")!;
    expect(body.hasInspectableStory).toBe(true);
    expect(body.processChains[0].stepCount).toBe(12);
    for (const coverage of queries.getProductOverview(productId)!.componentCoverage) expect(coverage.processChains.map(chain => chain.id), coverage.item.id).toContain("cotton-tshirt-process-chain");
    expect(queries.getProductBreakdown(productId)?.children).toHaveLength(4);
    expect(queries.getSupplyChainStory(productId)?.steps).toHaveLength(3);
    expect(fixture.items.every(item => !item.id.includes("smartphone") && !item.id.includes("battery"))).toBe(true);
    expect(JSON.stringify(fixture)).not.toContain('"method":"mock"');
  });

  it("preserves all four source records and independent quantity / weight quality flags", async () => {
    const raw = JSON.parse(await readFile(resolve("data/research/cotton-tshirt-2026-10-21/raw/comtrade-156-610910-2025.json"), "utf8"));
    expect(fixture.tradeObservations).toHaveLength(4);
    for (const row of raw.data) {
      const record = fixture.tradeObservations.find(entry => entry.partnerCode === row.partnerCode && entry.flowCode === row.flowCode)!;
      expect(record.reporterCode).toBe(row.reporterCode);
      expect(record.classificationVersion).toBe("2022");
      expect(record.classificationCode).toBe("610910");
      expect(record.period.label).toBe("2025");
      expect(record.value).toBe(row.primaryValue);
      expect(record.quantity).toBe(row.qty);
      expect(record.unit).toBe("items");
      expect(record.quantityDataStatus).toBe("observed");
      expect(record.quality?.isNetWgtEstimated).toBe(row.isNetWgtEstimated);
      expect(record.quality?.isAggregate).toBe(row.isAggregate);
      expect(record.quality?.isReported).toBe(row.isReported);
      expect(record.qualityNote).toContain(`"netWgt":${row.netWgt}`);
      expect(record.sourceId).toBe("source-cotton-comtrade");
    }
    const world = fixture.tradeObservations.filter(entry => entry.partnerScope === "world_total");
    expect(world).toHaveLength(2);
    expect(world.every(entry => entry.partnerEntityId === null && entry.partnerCode === 0 && entry.quality?.isNetWgtEstimated && entry.quantityDataStatus === "observed")).toBe(true);
    expect(built.audit.classification.className).toBe("HS2022");
    expect(built.audit.quantityUnit).toMatchObject({ qtyCode: 5, qtyAbbr: "u", qtyDescription: "Number of items" });
    expect(fixture.classificationCrosswalks[0].mappingType).toBe("aggregate");
    expect(fixture.classificationCrosswalks[0].limitation).toContain("汗衫");
  });

  it("keeps role evidence, direct material relations and representative connections distinct", () => {
    expect(fixture.storyGraph.flows).toHaveLength(12);
    expect(fixture.storyGraph.flows.every(flow => flow.value === null && flow.quantity === null && flow.valueDataStatus === "unknown" && flow.quantityDataStatus === "unknown")).toBe(true);
    const direct = fixture.storyGraph.flows.filter(flow => flow.evidenceLevel === "bilateral_supported");
    expect(direct.map(flow => flow.id)).toEqual(["cotton-flow-br-bd-lint", "cotton-flow-in-bd-yarn"]);
    expect(direct.every(flow => flow.period.start === "2024-08-01" && flow.period.end === "2025-07-31" && flow.flowKind === "curated_physical")).toBe(true);
    expect(fixture.storyGraph.flows.find(flow => flow.id === "cotton-flow-cn-us-example")?.evidenceLevel).toBe("representative");
    expect(fixture.storyGraph.nodes.find(node => node.id === "cotton-cn-knit")?.evidenceLevel).toBe("representative");
    expect(fixture.storyGraph.nodes.find(node => node.id === "cotton-bd-knit")?.evidenceLevel).toBe("role_supported");
    for (const record of [...fixture.storyGraph.nodes, ...fixture.storyGraph.flows]) {
      expect(record.period).toBeTruthy();
      expect(record.contentVersionId).toBe(fixture.contentVersions[0].id);
      expect(record.evidenceIds.length).toBeGreaterThan(0);
    }
  });

  it("represents alternative ring and rotor paths without requiring roving for rotor spinning", () => {
    const chain = queries.getManufacturingProcessChain(productId, "cotton-tshirt-process-chain")!;
    expect(chain.steps).toHaveLength(12);
    expect(chain.routeVariants).toHaveLength(2);
    const ring = chain.routeVariants.find(route => route.id === "cotton-ring-knit-route")!;
    const rotor = chain.routeVariants.find(route => route.id === "cotton-rotor-knit-route")!;
    expect(ring.stepIds).toContain("cotton-step-rove");
    expect(ring.stepIds).not.toContain("cotton-step-rotor");
    expect(rotor.stepIds).toContain("cotton-step-rotor");
    expect(rotor.stepIds).not.toContain("cotton-step-rove");
    expect(rotor.stepIds).not.toContain("cotton-step-ring");
    expect(chain.steps.every(step => step.inputItems.length > 0 && step.outputItems.length > 0 && step.evidence.length > 0 && step.sources.length > 0)).toBe(true);
    const gin = chain.steps.find(step => step.step.id === "cotton-step-gin")!;
    expect(gin.outputItems.map(item => item.id)).toEqual(["cotton-lint", "cotton-seed-byproduct"]);
    expect(chain.steps.find(step => step.step.id === "cotton-step-cut")?.outputItems.map(item => item.id)).toContain("tshirt-cutting-remnants");
    expect(chain.steps.find(step => step.step.id === "cotton-step-sew")?.outputItems[0].id).toBe(productId);
    expect(chain.organizations).toHaveLength(0);
    expect(fixture.equipmentCategories).toHaveLength(11);
  });

  it("maps all country branches and separates two world totals from two bilateral statistics", () => {
    const route = createMapView(queries, { product: productId, layer: "supply-chain" })!;
    expect(route.countries.map(country => country.id).sort()).toEqual(["country-bd", "country-br", "country-cn", "country-in", "country-us"]);
    expect(route.countries.every(country => country.m49)).toBe(true);
    expect(route.lines.map(line => line.id)).toContain("cotton-flow-br-bd-lint");
    expect(route.lines.map(line => line.id)).toContain("cotton-flow-in-bd-yarn");
    const trade = createMapView(queries, { product: productId, layer: "trade", year: "2025" })!;
    expect(trade.lines).toHaveLength(2);
    expect(trade.lines.every(line => line.unit === "items" && line.fromCountryId && line.toCountryId)).toBe(true);
    expect(queries.getTradeMapView(productId)?.observations.filter(row => row.partnerScope === "world_total")).toHaveLength(2);
    expect(createMapView(queries, { product: productId, layer: "trade", year: "2024" })?.lines).toHaveLength(0);
    expect(queries.getTradeMapView(productId, { countryEntityId: "country-bd" })?.observations).toHaveLength(0);
  });

  it("offers truthful country ledgers and preserves shared macro source versions without phone trade", () => {
    const china = queries.getCountryLedger(productId, "country-cn", { label: "2025" })!;
    expect(china.tradeObservations).toHaveLength(4);
    expect(china.macroIndicators).toHaveLength(3);
    expect(china.tradeObservations.every(row => row.itemId === productId && row.classificationCode === "610910")).toBe(true);
    const bd = queries.getCountryLedger(productId, "country-bd")!;
    expect(bd.tradeAvailability).toBe("unknown");
    expect(bd.tradeObservations).toHaveLength(0);
    expect(bd.relatedNodes.length).toBeGreaterThan(0);
    expect(fixture.macroIndicators).toHaveLength(12);
    for (const row of fixture.macroIndicators) {
      expect(["country-cn", "country-us"]).toContain(row.entityId);
      expect(["2024", "2025"]).toContain(row.period.label);
      expect(fixture.sources.find(source => source.id === row.sourceId)?.datasetVersion).toBe("WDI-2026-07-13");
    }
    expect(built.audit.emptyTradeResponses).toHaveLength(2);
    expect(fixture.tradeGuides).toHaveLength(0);
    expect(fixture.materialTradeObservations).toHaveLength(0);
  });

  it("rebuilds byte-identically and hashes content, raw inputs, fixture and audit", async () => {
    const again = await buildCottonTshirt();
    expect(again.files).toEqual(built.files);
    expect(built.manifest.fixtureSha256).toBe(hash(built.files["fixture.json"]));
    expect(built.manifest.evidenceReview.auditSha256).toBe(hash(built.files["review-audit.json"]));
    expect(built.manifest.evidenceReview.contentSha256).toBe(hash(await readFile(cottonContentPath)));
    expect(built.manifest.evidenceReview.sourceReviewSha256).toBe(hash(await readFile(cottonReviewPath)));
    expect(built.audit.validation.activeManifestChanged).toBe(false);
  });

  it("loads the prepared file format through the published-only fixture adapter", async () => {
    const temporary = await mkdtemp(resolve(tmpdir(), "globe-cotton-adapter-"));
    for (const [name, bytes] of Object.entries(built.files)) await writeFile(resolve(temporary, name), bytes as string);
    const repository = await loadFixtureRepositoryFromManifest(resolve(temporary, "manifest.json"));
    expect(repository.listProductIds()).toEqual([productId]);
    const loaded = createProductQueryService(repository);
    expect(loaded.getProductOverview(productId)?.datasetVersion.version).toBe("globe-chain-cotton-tshirt-2026.1");
    expect(loaded.getTradeMapView(productId)?.observations).toHaveLength(4);
    expect(Object.isFrozen(repository.getProductFixture(productId))).toBe(true);
  });

  it("rejects a tampered reviewed input before constructing published facts", async () => {
    const temporary = await mkdtemp(resolve(tmpdir(), "globe-cotton-source-"));
    for (const path of [cottonContentPath, cottonReviewPath]) {
      await mkdir(dirname(resolve(temporary, path)), { recursive: true });
      await cp(resolve(path), resolve(temporary, path));
    }
    const first = built.audit.inputs.snapshots[0].path;
    await mkdir(dirname(resolve(temporary, first)), { recursive: true });
    await writeFile(resolve(temporary, first), "tampered source");
    await expect(buildCottonTshirt(temporary)).rejects.toThrow("Reviewed source hash changed");
  });
});
