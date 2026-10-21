import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ProductFixtureSchema, type ProductFixture } from "@globe-chain/contracts";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createInMemoryFixtureRepository, createProductQueryService, type ProductQueryService } from "@globe-chain/domain";
import { buildHomeAirConditioner, homeAirConditionerContentPath, homeAirConditionerReviewPath } from "../scripts/build-home-air-conditioner.mjs";
import { createMapView } from "../apps/web/lib/map-view-model";

const productId = "generic-home-air-conditioner";
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

describe("home air conditioner independent candidate", () => {
  let built: Awaited<ReturnType<typeof buildHomeAirConditioner>>;
  let fixture: ProductFixture;
  let queries: ProductQueryService;

  beforeAll(async () => {
    built = await buildHomeAirConditioner();
    fixture = ProductFixtureSchema.parse(built.fixture);
    queries = createProductQueryService(createInMemoryFixtureRepository([fixture]));
  });

  it("passes the complete published contract and exposes eight useful component entrances", () => {
    expect(fixture.datasetVersion.status).toBe("published");
    expect(fixture.items).toHaveLength(22);
    expect(fixture.storyGraph.steps).toHaveLength(5);
    const overview = queries.getProductOverview(productId)!;
    expect(overview.product.description?.startsWith("为房间降温")).toBe(true);
    expect(overview.directChildren.map(item => item.id)).toEqual(["ac-compressor", "ac-heat-exchanger", "ac-fan-motor", "ac-controller", "ac-valves", "ac-refrigerant", "ac-housing", "ac-packaging"]);
    expect(queries.getProductBreakdown(productId)?.children).toHaveLength(8);
    for (const coverage of overview.componentCoverage) {
      expect(coverage.hasInspectableStory, coverage.item.id).toBe(true);
      expect(coverage.nodeCount, coverage.item.id).toBeGreaterThan(0);
      expect(coverage.processChains.map(chain => chain.id), coverage.item.id).toContain("home-ac-room-manufacturing-chain");
      expect(fixture.manufacturingProcessSteps.some(step => [...step.inputItemIds, ...step.outputItemIds].includes(coverage.item.id)), coverage.item.id).toBe(true);
      expect(queries.getSupplyChainStory(productId, { focusItemId: coverage.item.id })?.nodes.some(view => view.item?.id === coverage.item.id), coverage.item.id).toBe(true);
    }
  });

  it("preserves the four real 2024 bilateral export rows, quantities, weights and independent flags exactly", async () => {
    const raw = JSON.parse(await readFile(resolve("data/raw/home-ac-research/un-comtrade-china-hs8415-2024.json"), "utf8"));
    const selected = raw.data.filter((row: any) => row.flowCode === "X" && [276, 842].includes(row.partnerCode));
    expect(selected).toHaveLength(4);
    expect(fixture.tradeObservations).toHaveLength(4);
    for (const row of selected) {
      const observation = fixture.tradeObservations.find(entry => entry.partnerCode === row.partnerCode && entry.classificationCode === row.cmdCode)!;
      expect(observation).toBeTruthy();
      expect(observation).toMatchObject({ reporterEntityId: "country-cn", reporterCode: 156, partnerCode: row.partnerCode, flowCode: "X", direction: "export", partnerScope: "entity", classificationSystem: "HS", classificationVersion: "2022", classificationCode: row.cmdCode, currency: "USD", unit: "items", value: row.fobvalue, quantity: row.qty, valueDataStatus: "observed", quantityDataStatus: "observed", method: "official" });
      expect(observation.value).toBe(row.primaryValue);
      expect(observation.period).toEqual({ granularity: "annual", start: "2024-01-01", end: "2024-12-31", label: "2024" });
      for (const flag of ["isQtyEstimated", "isNetWgtEstimated", "isReported", "isAggregate", "legacyEstimationFlag"] as const) expect(observation.quality?.[flag]).toBe(row[flag]);
      expect(observation.qualityNote).toContain(`"netWgt":${row.netWgt}`);
      expect(observation.qualityNote).toContain(`"fobvalue":${row.fobvalue}`);
      const audited = built.audit.tradeRows.find((entry: any) => entry.id === observation.id)!;
      expect(audited).toMatchObject({ primaryValue: row.primaryValue, fobvalue: row.fobvalue, qty: row.qty, netWgt: row.netWgt, qtyUnitCode: 5, normalizedUnit: "items" });
      expect(audited.original.isOriginalClassification).toBe(true);
    }
    expect(built.audit.excludedTradeRows).toHaveLength(8);
    expect(built.audit.excludedTradeRows.filter((row: any) => row.partnerCode === 0)).toHaveLength(4);
    expect(fixture.tradeObservations.some(row => row.partnerScope === "world_total" || row.partnerCode === 0)).toBe(false);
    expect(fixture.materialTradeObservations).toHaveLength(0);
  });

  it("retains broad product mappings while limiting bilateral evidence to explicit HS category items", () => {
    const productMappings = fixture.classificationCrosswalks.filter(mapping => mapping.itemId === productId);
    expect(productMappings).toHaveLength(2);
    expect(productMappings.every(mapping => mapping.mappingType === "aggregate" && mapping.limitation?.includes("宽口径"))).toBe(true);
    for (const code of ["841510", "841582"]) {
      const categoryMapping = fixture.classificationCrosswalks.find(mapping => mapping.itemId === `ac-related-hs${code}`)!;
      expect(categoryMapping.mappingType).toBe("exact");
      expect(fixture.classificationCodes.find(entry => entry.id === categoryMapping.classificationCodeId)?.code).toBe(code);
    }
    const direct = fixture.storyGraph.flows.filter(flow => flow.evidenceLevel === "bilateral_supported");
    expect(direct).toHaveLength(4);
    for (const flow of direct) {
      expect(flow.itemId).toMatch(/^ac-related-hs841(510|582)$/);
      expect(flow.itemId).not.toBe(productId);
      expect(flow.flowKind).toBe("representative_supply");
      expect(flow.method).toBe("curated");
      const ev = fixture.evidence.find(entry => flow.evidenceIds.includes(entry.id) && entry.supportType === "bilateral_flow")!;
      expect(ev.scope?.supportsBilateralFlow).toBe(true);
      expect(ev.scope?.itemIds).toEqual([flow.itemId]);
      expect(ev.scope?.fromEntityId).toBe("country-cn");
      expect(["country-de", "country-us"]).toContain(ev.scope?.toEntityId);
      expect(ev.scope?.period).toEqual(flow.period);
      expect(ev.scope?.classificationCodes[0].mappingType).toBe("exact");
      expect(ev.scope?.itemIds).not.toContain(productId);
    }
    expect(built.audit.quantityUnit).toMatchObject({ qtyCode: 5, qtyAbbr: "u", qtyDescription: "Number of items" });
  });

  it("retains the verified 1997 technical reference and separate 2017 production context", () => {
    expect(built.audit.publicationCorrections[0]).toMatchObject({ researchDraftPeriod: "1996", verifiedPeriod: "1997" });
    expect(fixture.sources.find(source => source.id === "source-home-ac-doe")?.publishedAt).toBe("1997-09");
    expect(fixture.sources.find(source => source.id === "source-home-ac-iea")?.license).toContain("All rights reserved");
    for (const record of [...fixture.manufacturingProcessChains, ...fixture.manufacturingProcessSteps, ...fixture.processRequirements, ...fixture.equipmentCategories]) {
      expect(record.period.start).toBe("1997-01-01");
      expect(record.period.end).toBe("1997-12-31");
      expect(record.sourceIds.length).toBeGreaterThan(0);
      expect(record.datasetVersionId).toBe(fixture.datasetVersion.id);
    }
    const role = fixture.storyGraph.nodes.find(node => node.id === "home-ac-cn-role")!;
    expect(role.evidenceLevel).toBe("role_supported");
    expect(role.period?.start).toBe("2017-01-01");
    expect(role.period?.label).toContain("IEA2019");
    expect(fixture.macroIndicators).toHaveLength(0);
    expect(fixture.productionActivities).toHaveLength(1);
    expect(fixture.storyGraph.nodes.filter(node => node.period?.start === "1997-01-01").every(node => node.entityId === null)).toBe(true);
  });

  it("offers nine inspectable input/output steps and twelve equipment classes without supplier claims", () => {
    const chain = queries.getManufacturingProcessChain(productId, "home-ac-room-manufacturing-chain")!;
    expect(chain.steps).toHaveLength(9);
    expect(fixture.equipmentCategories).toHaveLength(12);
    expect(chain.organizations).toHaveLength(0);
    for (const step of chain.steps) {
      expect(step.inputItems.length, step.step.id).toBeGreaterThan(0);
      expect(step.outputItems.length, step.step.id).toBeGreaterThan(0);
      expect(step.evidence.length, step.step.id).toBeGreaterThan(0);
      expect(step.sources.length, step.step.id).toBeGreaterThan(0);
      expect(step.requirements.some(requirement => requirement.equipmentCategory && requirement.evidence.length > 0), step.step.id).toBe(true);
      expect(step.requirements.every(requirement => requirement.capabilities.length === 0)).toBe(true);
    }
    expect(chain.steps.find(step => step.step.id === "home-ac-step-subassembly")?.inputItems.map(item => item.id)).toEqual(["ac-compressor", "ac-fan-motor", "ac-valves", "ac-controller"]);
    expect(chain.steps[8].outputItems.map(item => item.id)).toEqual([productId]);
    const molding = fixture.processRequirements.find(row => row.equipmentCategoryId === "home-ac-equipment-plastic-molding")!;
    expect(molding.necessity).toBe("optional");
    expect(molding.description).toContain("塑料件可外购或厂内成型");
    expect(fixture.organizations).toHaveLength(0);
    expect(fixture.organizationCapabilities).toHaveLength(0);
    expect(fixture.facilities).toHaveLength(0);
  });

  it("connects every technical input to the finished product and then the explicit market branches", () => {
    const reach = (start: string) => {
      const seen = new Set([start]);
      for (let i = 0; i < fixture.storyGraph.nodes.length; i++) for (const flow of fixture.storyGraph.flows) if (seen.has(flow.fromEntityId)) seen.add(flow.toEntityId);
      return seen;
    };
    for (const item of ["ac-sheet-metal", "ac-plastic-grille", "ac-copper-tube", "ac-aluminium-sheet", "ac-return-bends", "ac-compressor", "ac-fan-motor", "ac-valves", "ac-controller", "ac-refrigerant", "ac-packaging"]) {
      const reached = reach(`home-ac-node-${item}`);
      expect(reached.has(`home-ac-node-${productId}`), item).toBe(true);
      for (const partner of [276, 842]) for (const code of ["841510", "841582"]) expect(reached.has(`home-ac-market-${code}-${partner}`), `${item}/${code}/${partner}`).toBe(true);
    }
    expect(fixture.storyGraph.nodes).toHaveLength(27);
    expect(fixture.storyGraph.flows).toHaveLength(26);
    expect(fixture.storyGraph.flows.every(flow => flow.value === null && flow.quantity === null && flow.valueDataStatus === "unknown" && flow.quantityDataStatus === "unknown")).toBe(true);
  });

  it("uses three valid geographic countries, four direct map lines and truthful unknown ledgers", () => {
    const route = createMapView(queries, { product: productId, layer: "supply-chain" })!;
    expect(route.countries.map(country => country.id).sort()).toEqual(["country-cn", "country-de", "country-us"]);
    expect(route.lines).toHaveLength(4);
    expect(route.lines.every(line => line.evidenceCode === "bilateral_supported" && line.fromCountryId === "country-cn" && line.fromCountryId !== line.toCountryId)).toBe(true);
    const trade = createMapView(queries, { product: productId, layer: "trade", year: "2024" })!;
    expect(trade.lines).toHaveLength(4);
    expect(trade.lines.every(line => line.unit === "items" && ["841510", "841582"].includes(line.classificationCode ?? ""))).toBe(true);
    expect(trade.lines.every(line => line.classificationMappingType === "aggregate" && line.notes?.includes("宽口径"))).toBe(true);
    expect(fixture.classificationCodes.map(code => code.label)).toEqual(built.audit.classification.selectedEntries.map((entry: any) => entry.text));
    expect(trade.lines.filter(line => line.toCountryId === "country-us").every(line => line.toM49 === "840")).toBe(true);
    expect(fixture.tradeObservations.filter(row => row.partnerEntityId === "country-us").every(row => row.partnerCode === 842)).toBe(true);
    expect(queries.getCountryLedger(productId, "country-cn", { label: "2024" })?.tradeObservations).toHaveLength(4);
    for (const country of ["country-us", "country-de"]) {
      const ledger = queries.getCountryLedger(productId, country)!;
      expect(ledger.tradeAvailability).toBe("unknown");
      expect(ledger.tradeObservations).toHaveLength(0);
      expect(ledger.relatedNodes.length).toBeGreaterThan(0);
    }
    expect(createMapView(queries, { product: productId, layer: "trade", year: "2026" })?.lines).toHaveLength(0);
    expect(fixture.tradeGuides).toHaveLength(0);
  });

  it("returns original sources and evidence through cross-module queries without inherited product facts", () => {
    const provenance = queries.getProvenance(productId)!;
    expect(provenance.sources.length).toBe(7);
    expect(queries.getSupplyChainStory(productId)?.steps).toHaveLength(5);
    expect(queries.getTradeMapView(productId)?.observations).toHaveLength(4);
    expect(JSON.stringify(fixture)).not.toMatch(/generic-smartphone|battery-module|source-synthetic|"method":"mock"/);
    for (const record of [...fixture.storyGraph.nodes, ...fixture.storyGraph.flows]) {
      expect(record.period).toBeTruthy();
      expect(record.evidenceIds.length).toBeGreaterThan(0);
      expect(record.contentVersionId).toBe(fixture.contentVersions[0].id);
      expect(record.sourceIds.every(id => fixture.sources.some(source => source.id === id))).toBe(true);
    }
    expect(fixture.evidenceGaps[0].nonInferences.join(" ")).toContain("不把1997工艺当作2026中国现况");
  });

  it("rebuilds byte-identically and verifies every pinned input plus all output hashes", async () => {
    const again = await buildHomeAirConditioner();
    expect(again.files).toEqual(built.files);
    expect(built.manifest.fixtureSha256).toBe(hash(built.files["fixture.json"]));
    expect(built.manifest.evidenceReview.auditSha256).toBe(hash(built.files["review-audit.json"]));
    expect(built.manifest.evidenceReview.contentSha256).toBe(hash(await readFile(homeAirConditionerContentPath)));
    expect(built.manifest.evidenceReview.sourceReviewSha256).toBe(hash(await readFile(homeAirConditionerReviewPath)));
    for (const input of [...built.audit.inputs.snapshots, built.audit.inputs.rawManifest]) expect(hash(await readFile(input.path))).toBe(input.sha256);
    expect(built.audit.validation.activeManifestChanged).toBe(false);
  });

  it("loads its candidate bytes through the actual published-only immutable fixture loader", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "globe-home-ac-loader-"));
    for (const [name, bytes] of Object.entries(built.files)) await writeFile(resolve(directory, name), bytes as string);
    const repository = await loadFixtureRepositoryFromManifest(resolve(directory, "manifest.json"));
    expect(repository.listProductIds()).toEqual([productId]);
    expect(Object.isFrozen(repository.getProductFixture(productId))).toBe(true);
    const loaded = createProductQueryService(repository);
    expect(loaded.getProductOverview(productId)?.datasetVersion.version).toBe("globe-chain-home-air-conditioner-2026.1");
    expect(loaded.getManufacturingProcessChain(productId, "home-ac-room-manufacturing-chain")?.steps).toHaveLength(9);
    expect(loaded.getTradeMapView(productId)?.observations).toHaveLength(4);
  });

  it("rejects source tampering and unsupported promotions before releasing facts", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "globe-home-ac-tamper-"));
    const review = JSON.parse(await readFile(homeAirConditionerReviewPath, "utf8"));
    for (const path of [homeAirConditionerContentPath, homeAirConditionerReviewPath, review.rawManifest.path]) {
      await mkdir(dirname(resolve(directory, path)), { recursive: true });
      await cp(resolve(path), resolve(directory, path));
    }
    const first = review.sourceSnapshots[0].path;
    await mkdir(dirname(resolve(directory, first)), { recursive: true });
    await writeFile(resolve(directory, first), "tampered source");
    await expect(buildHomeAirConditioner(directory)).rejects.toThrow("Reviewed source hash changed");
    const promoted = structuredClone(fixture);
    promoted.storyGraph.flows[0].evidenceLevel = "bilateral_supported";
    expect(ProductFixtureSchema.safeParse(promoted).success).toBe(false);
    const falseZero = structuredClone(fixture);
    falseZero.storyGraph.flows[0].quantity = 0;
    expect(ProductFixtureSchema.safeParse(falseZero).success).toBe(false);
    const exactProduct = structuredClone(fixture);
    const direct = exactProduct.storyGraph.flows.find(flow => flow.evidenceLevel === "bilateral_supported")!;
    direct.itemId = productId;
    expect(ProductFixtureSchema.safeParse(exactProduct).success).toBe(false);
  });
});
