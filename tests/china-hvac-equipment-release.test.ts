import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ProductFixtureSchema, type ProductFixture } from "@globe-chain/contracts";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createInMemoryFixtureRepository, createProductQueryService } from "@globe-chain/domain";
import { buildChinaHvacEquipment, chinaHvacEquipmentBasePath, chinaHvacEquipmentResearchPath } from "../scripts/build-china-hvac-equipment.mjs";
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const remap = (value: any, previous: string, current: string): any => Array.isArray(value) ? value.map(child => remap(child, previous, current)) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === "datasetVersionId" && child === previous ? current : remap(child, previous, current)])) : value;

describe("China HVAC equipment and official service expansion", () => {
  let built: Awaited<ReturnType<typeof buildChinaHvacEquipment>>;
  let fixture: ProductFixture, baseline: ProductFixture;
  beforeAll(async () => {
    built = await buildChinaHvacEquipment();
    fixture = ProductFixtureSchema.parse(built.fixture);
    baseline = ProductFixtureSchema.parse(JSON.parse(await readFile(chinaHvacEquipmentBasePath, "utf8")));
  });
  it("preserves all product, process and trade facts in a separate release", async () => {
    expect(fixture.datasetVersion.version).toBe("globe-chain-home-air-conditioner-2026.3");
    const retained = remap(baseline, baseline.datasetVersion.id, fixture.datasetVersion.id);
    for (const [key, value] of Object.entries(retained)) if (!["datasetVersion", "sources", "contentVersions", "industryNetwork"].includes(key)) expect((fixture as any)[key], key).toEqual(value);
    expect(fixture.sources.slice(0, baseline.sources.length)).toEqual(baseline.sources);
    expect(fixture.contentVersions.slice(0, baseline.contentVersions.length)).toEqual(baseline.contentVersions);
    expect(hash(await readFile(chinaHvacEquipmentBasePath))).toBe("78028e78b4e2293ae59af289968afa7471867405d428666abefc6bb496eb1a33");
    expect(fixture.manufacturingProcessSteps).toHaveLength(9);
    expect(fixture.tradeObservations).toHaveLength(4);
  });
  it("appends industry facts and preserves old organizations without duplicate companies", () => {
    const network = fixture.industryNetwork!, old = remap(baseline.industryNetwork, baseline.datasetVersion.id, fixture.datasetVersion.id);
    expect(network.topics.slice(0, old.topics.length)).toEqual(old.topics);
    expect(network.relations.slice(0, old.relations.length)).toEqual(old.relations);
    const changedIds = new Set(built.audit.organizationExtensions.map((entry: any) => entry.id));
    for (const organization of old.organizations) {
      const current = network.organizations.find(row => row.id === organization.id)!;
      if (!changedIds.has(organization.id)) expect(current).toEqual(organization);
      else {
        expect(current.name).toBe(organization.name);
        expect(current.description).toBe(organization.description);
        expect(current.topicIds).toEqual(expect.arrayContaining(organization.topicIds));
        expect(current.sourceIds).toEqual(expect.arrayContaining(organization.sourceIds));
        expect(current.links).toEqual(expect.arrayContaining(organization.links));
        const audit = built.audit.organizationExtensions.find((entry: any) => entry.id === organization.id)!;
        expect(audit.before).toEqual(organization);
        expect(audit.after).toEqual(current);
        expect(current.period.start <= audit.before.period.start).toBe(true);
        expect(current.period.end >= audit.before.period.end).toBe(true);
      }
    }
    expect(new Set(network.organizations.map(organization => organization.id)).size).toBe(network.organizations.length);
    expect(network.organizations.filter(organization => organization.id === "org-gree")).toHaveLength(1);
    expect(new Set(network.relations.map(relation => `${relation.fromTopicId}|${relation.toTopicId}|${relation.kind}`)).size).toBe(network.relations.length);
    expect(built.audit.added.organizations).toBeGreaterThanOrEqual(2);
  });
  it("connects new equipment to applications and official capability entrances through generic queries", () => {
    const queries = createProductQueryService(createInMemoryFixtureRepository([fixture]));
    const network = fixture.industryNetwork!, previousTopics = new Set(baseline.industryNetwork!.topics.map(topic => topic.id));
    const addedEquipment = network.topics.filter(topic => !previousTopics.has(topic.id) && topic.kind === "equipment");
    expect(addedEquipment.length).toBeGreaterThanOrEqual(2);
    for (const topic of addedEquipment) {
      const view = queries.getIndustryNetwork(fixture.productId, { topicId: topic.id })!;
      expect(view.participants.length + view.adjacentParticipants.length, topic.id).toBeGreaterThan(0);
      expect(view.downstream.length, topic.id).toBeGreaterThan(0);
      const reached = new Set([topic.id]);
      for (let pass = 0; pass < network.topics.length; pass++) for (const relation of network.relations) if (reached.has(relation.fromTopicId)) reached.add(relation.toTopicId);
      expect([...reached].some(id => previousTopics.has(id)), topic.id).toBe(true);
      expect(view.participants.flatMap(company => company.links).every(link => /^https?:\/\//.test(link.url))).toBe(true);
      expect(view.sources.length).toBeGreaterThan(0);
    }
    const support = network.organizations.flatMap(organization => organization.links).filter(link => link.kind === "support");
    expect(support.length).toBeGreaterThan(0);
    for (const process of fixture.manufacturingProcessChains) expect(process.period.start).toBe("1997-01-01");
    const exported = queries.getProductResearchExport(fixture.productId)!;
    expect(exported.recordCounts.industryParticipants).toBe(network.organizations.length);
    expect(exported.snapshot.industryNetwork?.relations.length).toBe(network.relations.length);
  });
  it("rebuilds identical bytes from pinned sources and carries complete provenance", async () => {
    const again = await buildChinaHvacEquipment();
    expect(again.files).toEqual(built.files);
    expect(built.manifest.fixtureSha256).toBe(hash(built.files["fixture.json"]));
    expect(built.manifest.evidenceReview.auditSha256).toBe(hash(built.files["review-audit.json"]));
    for (const input of built.audit.inputs) expect(hash(await readFile(input.path)), input.path).toBe(input.sha256);
    const network = fixture.industryNetwork!;
    for (const record of [network, ...network.topics, ...network.relations, ...network.organizations]) {
      expect(record.sourceIds.length).toBeGreaterThan(0);
      expect(record.sourceIds.every(id => fixture.sources.some(source => source.id === id))).toBe(true);
      expect(record.datasetVersionId).toBe(fixture.datasetVersion.id);
      expect(record.unit).toBe("not_applicable");
      expect(record.method).toBe("curated");
    }
    expect(built.audit.validation).toEqual({ activeManifestChanged: false, baseReleaseChanged: false, runtimeExternalCalls: false, mockRecordsAdded: false });
  });
  it("loads new candidate through the published immutable adapter without changing trade results", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "globe-hvac-equipment-loader-"));
    for (const [name, bytes] of Object.entries(built.files)) await writeFile(resolve(directory, name), bytes as string);
    const repository = await loadFixtureRepositoryFromManifest(resolve(directory, "manifest.json"));
    expect(Object.isFrozen(repository.getProductFixture(fixture.productId))).toBe(true);
    const queries = createProductQueryService(repository);
    expect(queries.getProductOverview(fixture.productId)?.datasetVersion.version).toBe("globe-chain-home-air-conditioner-2026.3");
    expect(queries.getTradeMapView(fixture.productId)?.observations).toHaveLength(4);
    expect(queries.getIndustryNetwork(fixture.productId)?.network.organizations.length).toBe(fixture.industryNetwork!.organizations.length);
  });
  it("rejects broken new provenance or unsafe official links and tampered original bytes", async () => {
    const badSource = structuredClone(fixture);
    badSource.industryNetwork!.topics.at(-1)!.sourceIds = ["invented-source"];
    expect(ProductFixtureSchema.safeParse(badSource).success).toBe(false);
    const unsafe = structuredClone(fixture);
    unsafe.industryNetwork!.organizations.at(-1)!.links[0].url = "javascript:alert(1)";
    expect(ProductFixtureSchema.safeParse(unsafe).success).toBe(false);
    const directory = await mkdtemp(resolve(tmpdir(), "globe-hvac-equipment-tamper-"));
    await mkdir(dirname(resolve(directory, chinaHvacEquipmentBasePath)), { recursive: true });
    await writeFile(resolve(directory, chinaHvacEquipmentBasePath), "changed base");
    await expect(buildChinaHvacEquipment(directory)).rejects.toThrow("Reviewed input hash changed");
    await writeFile(resolve(directory, chinaHvacEquipmentBasePath), await readFile(chinaHvacEquipmentBasePath));
    await mkdir(dirname(resolve(directory, chinaHvacEquipmentResearchPath)), { recursive: true });
    await writeFile(resolve(directory, chinaHvacEquipmentResearchPath), "changed reviewed research");
    await expect(buildChinaHvacEquipment(directory)).rejects.toThrow("Reviewed input hash changed");
  });
});
