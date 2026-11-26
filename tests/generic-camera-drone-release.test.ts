import { createHash } from "node:crypto";
import { readFile, mkdtemp, mkdir, cp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { ProductFixtureSchema, type ProductFixture } from "@globe-chain/contracts";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createInMemoryFixtureRepository, createProductQueryService, type ProductQueryService } from "@globe-chain/domain";
import { buildCameraDrone, cameraDroneInputPath, cameraDronePartsPath } from "../scripts/build-drone.mjs";

const productId = "generic-camera-drone";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

describe("generic camera drone independent candidate", () => {
  let built: Awaited<ReturnType<typeof buildCameraDrone>>;
  let fixture: ProductFixture;
  let queries: ProductQueryService;

  beforeAll(async () => {
    built = await buildCameraDrone();
    fixture = ProductFixtureSchema.parse(built.fixture);
    queries = createProductQueryService(createInMemoryFixtureRepository([fixture]));
  });

  it("passes published contracts and exposes the three official component groups through generic queries", () => {
    expect(fixture.datasetVersion.status).toBe("published");
    expect(fixture.items).toHaveLength(16);
    const overview = queries.getProductOverview(productId)!;
    expect(fixture.items.find((item) => item.id === productId)?.name).toBe("航拍无人机");
    expect(overview.directChildren).toHaveLength(3);
    expect(queries.getProductBreakdown(productId)?.children).toHaveLength(3);
    for (const component of overview.componentCoverage) {
      expect(component.hasInspectableStory, component.item.id).toBe(true);
      expect(component.processChains.length, component.item.id).toBe(0);
    }
    expect(fixture.storyGraph.steps).toHaveLength(1);
    expect(fixture.storyGraph.flows).toHaveLength(0);
    expect(JSON.stringify(fixture).includes('"method":"mock"')).toBe(false);
    expect(fixture.items.some((item) => /smartphone|soybean|cotton|ebike|air-conditioner/.test(item.id))).toBe(false);
    expect(fixture.items.some((item) => /本批|不指定|不代表|未核验|没有|不表示/.test(item.description ?? ""))).toBe(false);
  });

  it("keeps all 86 official part rows traceable to the snapshot and maps every row to a curated node", () => {
    expect(built.audit.partsAudit).toHaveLength(86);
    expect(built.audit.counts.mappedRows).toBe(86);
    expect(built.audit.counts.unmappedRows).toBe(0);
    expect(built.audit.counts.distinctOfficialNames).toBe(35);
    expect(built.audit.counts.models).toBe(9);
    expect(built.audit.counts.officialCategories).toBe(3);
    const itemIds = new Set(fixture.items.map((item) => item.id));
    for (const row of built.audit.partsAudit) {
      expect(row.sourceId).toBe("source-dji-parts");
      expect(row.snapshotSha256).toBeTruthy();
      expect(itemIds.has(row.mappedNodeId)).toBe(true);
      expect(row.officialPartName).toBeTruthy();
      expect(row.rawRowSha256).toBe(hash(JSON.stringify(row.original)));
    }
    expect(built.audit.purchaseNoteOnly).toContain("桨叶");
  });

  it("maps the product to the HS2022 8806 heading only at aggregate level", () => {
    const code = fixture.classificationCodes.find((candidate) => candidate.code === "8806")!;
    expect(code.level).toBe(4);
    expect(code.label).toContain("Unmanned aircraft");
    const crosswalk = fixture.classificationCrosswalks[0];
    expect(crosswalk.mappingType).toBe("aggregate");
    expect(crosswalk.limitation).toContain("子目");
    expect(fixture.classificationCrosswalks).toHaveLength(1);
  });

  it("keeps trade, country, material and process dimensions as honest empty states with explicit gaps", () => {
    expect(fixture.tradeObservations).toHaveLength(0);
    expect(fixture.entities).toHaveLength(0);
    expect(fixture.materialTradeObservations).toHaveLength(0);
    expect(fixture.macroIndicators).toHaveLength(0);
    expect(fixture.tradeGuides).toHaveLength(0);
    expect(fixture.organizations).toHaveLength(0);
    expect(fixture.manufacturingProcessSteps).toHaveLength(0);
    expect(fixture.equipmentCategories).toHaveLength(0);
    expect(queries.listCountries()).toHaveLength(0);
    expect(queries.getTradeMapView(productId)?.observations).toHaveLength(0);
    expect(fixture.evidenceGaps).toHaveLength(4);
    const tradeGap = fixture.evidenceGaps.find((gap) => gap.gapId === "gap-drone-trade-8806")!;
    expect(tradeGap.status).toBe("open");
    expect(tradeGap.nonInferences.some((text) => text.includes("零"))).toBe(true);
    expect(tradeGap.classificationCandidates[0].code).toBe("8806");
    expect(tradeGap.classificationCandidates[0].supportsEndUse).toBe(false);
  });

  it("returns provenance and research export through common modules", () => {
    expect(fixture.sources).toHaveLength(3);
    expect(fixture.evidence).toHaveLength(3);
    expect(queries.getProvenance(productId)).toBeTruthy();
    const exported = queries.getProductResearchExport(productId)!;
    expect(exported.release.datasetVersion.version).toBe(fixture.datasetVersion.version);
    expect(exported.recordCounts).toMatchObject({
      entities: 0,
      items: 16,
      storyNodes: 16,
      storyFlows: 0,
      tradeObservations: 0,
      materialTradeObservations: 0,
      macroIndicators: 0,
      evidenceGaps: 4,
      manufacturingProcessChains: 0,
      manufacturingProcessSteps: 0,
      equipmentCategories: 0,
      organizations: 0
    });
  });

  it("rebuilds byte-identically and verifies reviewed input and audit hashes", async () => {
    const again = await buildCameraDrone();
    expect(again.files).toEqual(built.files);
    expect(built.manifest.fixtureSha256).toBe(hash(built.files["fixture.json"]));
    expect(built.manifest.evidenceReview.auditSha256).toBe(hash(built.files["review-audit.json"]));
    expect(built.manifest.evidenceReview.contentSha256).toBe(hash(await readFile(resolve(root(), cameraDroneInputPath))));
    for (const snapshot of built.audit.inputs.snapshots) {
      expect(hash(await readFile(resolve(root(), snapshot.path)))).toBe(snapshot.sha256);
    }
    expect(built.audit.validation.activeManifestChanged).toBe(false);
    expect(built.audit.validation.absentTradeRecordIsZero).toBe(false);
  });

  it("loads only this independent published candidate through the frozen fixture adapter", async () => {
    const temporary = await mkdtemp(resolve(tmpdir(), "globe-drone-adapter-"));
    for (const [name, bytes] of Object.entries(built.files)) await writeFile(resolve(temporary, name), bytes as string);
    const repository = await loadFixtureRepositoryFromManifest(resolve(temporary, "manifest.json"));
    expect(repository.listProductIds()).toEqual([productId]);
    expect(Object.isFrozen(repository.getProductFixture(productId))).toBe(true);
    const loaded = createProductQueryService(repository);
    expect(loaded.getProductOverview(productId)?.datasetVersion.version).toBe(fixture.datasetVersion.version);
    expect(loaded.getTradeMapView(productId)?.observations).toHaveLength(0);
  });

  it("rejects changed reviewed bytes before publishing any derived fact", async () => {
    const temporary = await mkdtemp(resolve(tmpdir(), "globe-drone-tamper-"));
    await mkdir(dirname(resolve(temporary, cameraDroneInputPath)), { recursive: true });
    await cp(resolve(root(), cameraDroneInputPath), resolve(temporary, cameraDroneInputPath));
    await cp(resolve(root(), cameraDronePartsPath), resolve(temporary, cameraDronePartsPath));
    const first = built.audit.inputs.snapshots[0].path;
    await mkdir(dirname(resolve(temporary, first)), { recursive: true });
    await writeFile(resolve(temporary, first), "tampered reviewed original");
    await expect(buildCameraDrone(temporary)).rejects.toThrow("Reviewed source hash changed");
  });
});

function root() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}
