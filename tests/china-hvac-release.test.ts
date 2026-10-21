import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ProductFixtureSchema, type ProductFixture } from "@globe-chain/contracts";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createInMemoryFixtureRepository, createProductQueryService } from "@globe-chain/domain";
import { buildChinaHvacNetwork, chinaHvacBasePath, chinaHvacResearchPath } from "../scripts/build-china-hvac-network.mjs";

const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const remap = (value: any, previous: string, current: string): any => Array.isArray(value)
  ? value.map(child => remap(child, previous, current))
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === "datasetVersionId" && child === previous ? current : remap(child, previous, current)]))
    : value;

describe("China HVAC participant network release", () => {
  let built: Awaited<ReturnType<typeof buildChinaHvacNetwork>>;
  let fixture: ProductFixture;
  let baseline: ProductFixture;
  beforeAll(async () => {
    built = await buildChinaHvacNetwork();
    fixture = ProductFixtureSchema.parse(built.fixture);
    baseline = ProductFixtureSchema.parse(JSON.parse(await readFile(chinaHvacBasePath, "utf8")));
  });

  it("adds a sourced generic industry network without altering existing product facts", async () => {
    expect(fixture.productId).toBe("generic-home-air-conditioner");
    expect(fixture.datasetVersion.version).toBe("globe-chain-home-air-conditioner-2026.2");
    expect(fixture.industryNetwork?.regionEntityId).toBe("country-cn");
    expect(fixture.industryNetwork?.defaultTopicId).toBe("heat-exchanger");
    const retained = remap(baseline, baseline.datasetVersion.id, fixture.datasetVersion.id);
    for (const [key, value] of Object.entries(retained)) {
      if (["datasetVersion", "sources", "contentVersions"].includes(key)) continue;
      expect((fixture as any)[key], key).toEqual(value);
    }
    expect(fixture.contentVersions.slice(0, baseline.contentVersions.length)).toEqual(baseline.contentVersions);
    expect(fixture.sources.slice(0, baseline.sources.length)).toEqual(baseline.sources);
    expect(hash(await readFile(chinaHvacBasePath))).toBe("19a3b48b7cb086fb399af3fbb6a8bc21420b9141c8db31fd6be2f7fea0352b39");
    expect(fixture.tradeObservations).toHaveLength(4);
    expect(fixture.manufacturingProcessSteps).toHaveLength(9);
  });

  it("makes materials, equipment, processing and applications discoverable with multiple official product links", () => {
    const network = fixture.industryNetwork!;
    expect(network.topics.length).toBeGreaterThanOrEqual(19);
    expect(network.organizations.length).toBeGreaterThanOrEqual(5);
    for (const kind of ["material", "component", "process", "equipment", "product", "channel"]) expect(network.topics.some(topic => topic.kind === kind), kind).toBe(true);
    const jingda = network.organizations.find(organization => organization.id === "org-jingda")!;
    expect(jingda.links.map(link => link.url)).toEqual(expect.arrayContaining(["https://www.nbjingda.com/productinfo/652949.html", "https://www.nbjingda.com/productinfo/652887.html"]));
    const snowman = network.organizations.find(organization => organization.id === "org-snowman")!;
    expect(snowman.links.map(link => link.url)).toEqual(expect.arrayContaining(["https://www.snowman.cn/en/product/evaporative_condenser.html", "https://www.snowman.cn/en/product/icemachine.html", "https://www.snowman.cn/en/about/contact_us.html"]));
    const gree = network.organizations.find(organization => organization.id === "org-gree")!;
    expect(gree.links.some(link => link.kind === "sales" && link.url.startsWith("https://mall.gree.com/"))).toBe(true);
    for (const organization of network.organizations) {
      expect(organization.links.length).toBeGreaterThan(0);
      expect(organization.links.every(link => /^https?:\/\//.test(link.url))).toBe(true);
      expect(new Set(organization.links.map(link => link.url)).size).toBe(organization.links.length);
      expect(organization.topicIds.every(id => network.topics.some(topic => topic.id === id))).toBe(true);
    }
    expect(network.relations.every(relation => network.topics.some(topic => topic.id === relation.fromTopicId) && network.topics.some(topic => topic.id === relation.toTopicId))).toBe(true);
    expect(new Set(network.relations.map(relation => `${relation.fromTopicId}|${relation.toTopicId}|${relation.kind}`)).size).toBe(network.relations.length);
    const reachable = new Set(["copper-material"]);
    for (let pass = 0; pass < network.topics.length; pass++) for (const relation of network.relations) if (reachable.has(relation.fromTopicId)) reachable.add(relation.toTopicId);
    expect([...reachable]).toEqual(expect.arrayContaining(["tube-manufacturing", "copper-tube", "heat-exchanger", "room-air-conditioner", "consumer-official-store"]));
    const currentLeak = network.relations.find(relation => relation.fromTopicId === "leak-testing" && relation.toTopicId === "heat-exchanger")!;
    expect(currentLeak.period.start).toBe("2026-10-22");
    expect(built.audit.originalRecords.relations.some((relation: any) => relation.fromTopicId === "leak-testing" && relation.toTopicId === "heat-exchanger" && relation.period.start === "1997-01-01")).toBe(true);
    expect(network.relations.some(relation => relation.fromTopicId === "copper-tube" && relation.toTopicId === "heat-exchanger")).toBe(true);
    expect(network.relations.some(relation => relation.fromTopicId === "heat-exchanger" && relation.toTopicId === "room-air-conditioner")).toBe(true);
  });

  it("preserves 1997 technical periods and exact dates of recent official observations", () => {
    const network = fixture.industryNetwork!;
    const historical = [...network.topics, ...network.relations].filter(record => record.period.start === "1997-01-01");
    expect(historical.length).toBeGreaterThan(0);
    for (const record of historical) {
      expect(record.period).toMatchObject({ granularity: "annual", start: "1997-01-01", end: "1997-12-31" });
      expect(record.sourceIds).toContain("source-china-hvac-doe-1997-manufacturing");
    }
    const recent = network.organizations.filter(record => record.period.start === "2026-10-21");
    expect(recent.length).toBeGreaterThanOrEqual(5);
    for (const record of recent) {
      expect(record.period.granularity).toBe("monthly");
      expect(record.period.end).toBe("2026-10-21");
      expect(record.period.label).toContain("快照");
    }
    for (const record of [network, ...network.topics, ...network.relations, ...network.organizations]) {
      expect(record.unit).toBe("not_applicable");
      expect(record.method).toBe("curated");
      expect(record.dataStatus).toBe("observed");
      expect(record.datasetVersionId).toBe(fixture.datasetVersion.id);
      expect(record.sourceIds.every(id => fixture.sources.some(source => source.id === id))).toBe(true);
    }
    expect(JSON.stringify(network)).not.toContain('"method":"mock"');
    expect(built.audit.originalRecords.topics.find((topic: any) => topic.id === "heat-exchanger").description).toContain("不泛化");
    expect(network.topics.find(topic => topic.id === "heat-exchanger")?.description).not.toContain("不泛化");
  });

  it("supports real participant tasks through the generic query rather than product-specific branches", () => {
    const queries = createProductQueryService(createInMemoryFixtureRepository([fixture]));
    const copper = queries.getIndustryNetwork(fixture.productId, { topicId: "copper-tube" })!;
    expect(copper.upstream.map(entry => entry.topic.id)).toContain("tube-manufacturing");
    expect(copper.downstream.map(entry => entry.topic.id)).toContain("heat-exchanger");
    expect(copper.participants.map(entry => entry.id)).toContain("org-jintian");
    const forming = queries.getIndustryNetwork(fixture.productId, { topicId: "fin-forming" })!;
    expect(forming.upstream.map(entry => entry.topic.id)).toContain("fin-press-equipment");
    expect(forming.adjacentParticipants.map(entry => entry.id)).toContain("org-jingda");
    const leak = queries.getIndustryNetwork(fixture.productId, { topicId: "leak-testing", search: "检漏" })!;
    expect(leak.adjacentParticipants.map(entry => entry.id)).toContain("hvac22-org-wayeal");
    expect(leak.directory.map(entry => entry.id)).toContain("hvac22-org-wayeal");
    const ice = queries.getIndustryNetwork(fixture.productId, { topicId: "ice-machine" })!;
    expect(ice.upstream.map(entry => entry.topic.id)).toContain("hvac22-finned-coil");
    expect(ice.participants.map(entry => entry.id)).toContain("org-snowman");
    const evaporative = queries.getIndustryNetwork(fixture.productId, { topicId: "evaporative-condenser" })!;
    expect(evaporative.upstream.map(entry => entry.topic.id)).not.toContain("copper-tube");
    expect(evaporative.participants[0]?.links.some(link => link.url.endsWith("evaporative_condenser.html"))).toBe(true);
    for (const [topicId, itemId] of [["hvaccore22-aircon-motor", "ac-fan-motor"], ["hvaccore22-ac-controller", "ac-controller"], ["hvaccore22-r32", "ac-refrigerant"], ["hvaccore22-housing", "ac-housing"]]) {
      const core = queries.getIndustryNetwork(fixture.productId, { topicId })!;
      expect(core.relatedItems.map(item => item.id), topicId).toContain(itemId);
      expect(core.relatedProcesses.map(chain => chain.id), topicId).toContain("home-ac-room-manufacturing-chain");
      expect(core.relatedProcesses.every(chain => chain.period.start === "1997-01-01"), topicId).toBe(true);
      expect(core.participants.length + core.adjacentParticipants.length, topicId).toBeGreaterThan(0);
    }
    const wolong = queries.getIndustryNetwork(fixture.productId, { search: "卧龙" })!;
    expect(wolong.directory.map(company => company.id)).toContain("hvaccore22-org-wolong");
    expect(wolong.matchingTopics.map(topic => topic.id)).toContain("hvaccore22-aircon-motor");
    expect(fixture.industryNetwork!.topics.find(topic => topic.id === "hvaccore22-pbt")?.itemIds).toBeUndefined();
    expect(built.audit.topicItemCrosswalk.find((entry: any) => entry.topicId === "hvaccore22-r32").notes).toContain("不将历史工艺工质改为R32");
    const exported = queries.getProductResearchExport(fixture.productId)!;
    expect(exported.includedModules).toContain("industry_network");
    expect(exported.recordCounts.industryParticipants).toBe(fixture.industryNetwork!.organizations.length);
    expect(exported.snapshot.industryNetwork?.relations.length).toBe(fixture.industryNetwork!.relations.length);
  });
  it("rejects unknown provenance, topic promotion and unsafe official links", () => {
    const unknownSource = structuredClone(fixture);
    unknownSource.industryNetwork!.organizations[0].sourceIds = ["invented-source"];
    expect(ProductFixtureSchema.safeParse(unknownSource).success).toBe(false);
    const falseVersion = structuredClone(fixture);
    falseVersion.industryNetwork!.topics[0].datasetVersionId = baseline.datasetVersion.id;
    expect(ProductFixtureSchema.safeParse(falseVersion).success).toBe(false);
    const unknownTopic = structuredClone(fixture);
    unknownTopic.industryNetwork!.relations[0].toTopicId = "invented-topic";
    expect(ProductFixtureSchema.safeParse(unknownTopic).success).toBe(false);
    const unknownItem = structuredClone(fixture);
    unknownItem.industryNetwork!.topics[0].itemIds = ["invented-item"];
    expect(ProductFixtureSchema.safeParse(unknownItem).success).toBe(false);
    const unsafe = structuredClone(fixture);
    unsafe.industryNetwork!.organizations[0].links[0].url = "javascript:alert(1)";
    expect(ProductFixtureSchema.safeParse(unsafe).success).toBe(false);
  });

  it("rebuilds exact bytes and verifies pinned original snapshots and linked official bodies", async () => {
    const again = await buildChinaHvacNetwork();
    expect(again.files).toEqual(built.files);
    expect(built.manifest.fixtureSha256).toBe(hash(built.files["fixture.json"]));
    expect(built.manifest.evidenceReview.auditSha256).toBe(hash(built.files["review-audit.json"]));
    for (const input of built.audit.inputs) expect(hash(await readFile(input.path)), input.path).toBe(input.sha256);
    expect(built.audit.sources.find((source: any) => source.id === "jingda-fin-press").linked).toHaveLength(1);
    expect(built.audit.validation).toEqual({ activeManifestChanged: false, baseReleaseChanged: false, runtimeExternalCalls: false, mockRecordsAdded: false });
  });

  it("loads candidate bytes through the real immutable published fixture adapter", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "globe-china-hvac-loader-"));
    for (const [name, bytes] of Object.entries(built.files)) await writeFile(resolve(directory, name), bytes as string);
    const repository = await loadFixtureRepositoryFromManifest(resolve(directory, "manifest.json"));
    const loaded = repository.getProductFixture(fixture.productId)!;
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(loaded.industryNetwork?.organizations.length).toBe(fixture.industryNetwork?.organizations.length);
    const queries = createProductQueryService(repository);
    expect(queries.getProductOverview(fixture.productId)?.datasetVersion.version).toBe("globe-chain-home-air-conditioner-2026.2");
    expect(queries.getTradeMapView(fixture.productId)?.observations).toHaveLength(4);
  });

  it("rejects tampered baseline or original source bytes before constructing a candidate", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "globe-china-hvac-tamper-"));
    await mkdir(dirname(resolve(directory, chinaHvacBasePath)), { recursive: true });
    await writeFile(resolve(directory, chinaHvacBasePath), "tampered baseline");
    await expect(buildChinaHvacNetwork(directory)).rejects.toThrow("Reviewed input hash changed");
    await cp(chinaHvacBasePath, resolve(directory, chinaHvacBasePath));
    await mkdir(dirname(resolve(directory, chinaHvacResearchPath)), { recursive: true });
    await cp(chinaHvacResearchPath, resolve(directory, chinaHvacResearchPath));
    const research = JSON.parse(await readFile(chinaHvacResearchPath, "utf8"));
    const source = research.sources[0];
    await mkdir(dirname(resolve(directory, source.rawFile)), { recursive: true });
    await writeFile(resolve(directory, source.rawFile), "tampered official original");
    await expect(buildChinaHvacNetwork(directory, { includeSupplement: false })).rejects.toThrow("Reviewed input hash changed");
  });
});
