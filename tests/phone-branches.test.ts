import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest, parseProductFixture } from "@globe-chain/db";
import { ProductFixtureSchema } from "@globe-chain/contracts";
import { createProductQueryService } from "@globe-chain/domain";
import baseline from "../data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/fixture.json";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
// Run the public Node entry module directly, matching the documented rebuild runtime.
async function buildPhoneBranches() {
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", "import { buildPhoneBranches } from './scripts/build-phone-branches.mjs'; process.stdout.write(JSON.stringify(await buildPhoneBranches()));"], { cwd: resolve("."), encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }));
}
const topComponents = baseline.items.filter((item) => item.parentItemId === "generic-smartphone").map((item) => item.id);
function withoutDataset(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutDataset);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === "datasetVersionId" ? "VERSION" : withoutDataset(child)]));
}

describe("2026.3 smartphone component completion", () => {
  it("rebuilds identical bytes, passes the complete contract and loads the candidate", async () => {
    const first = await buildPhoneBranches();
    const second = await buildPhoneBranches();
    expect(first.files).toEqual(second.files);
    const contract = ProductFixtureSchema.safeParse(first.fixture);
    expect(contract.success, contract.success ? "" : JSON.stringify(contract.error.issues)).toBe(true);
    expect(parseProductFixture(first.fixture).datasetVersion.version).toBe("globe-chain-smartphone-2026.3");
    const directory = await mkdtemp(resolve(tmpdir(), "globe-chain-phone-branches-"));
    try {
      for (const [name, bytes] of Object.entries(first.files)) await writeFile(resolve(directory, name), bytes as string);
      const repository = await loadFixtureRepositoryFromManifest(resolve(directory, "manifest.json"));
      const loaded = repository.getProductFixture("generic-smartphone")!;
      expect(loaded.datasetVersion.version).toBe(first.config.datasetVersion);
      expect(hash(await readFile(resolve(directory, "fixture.json")))).toBe(first.manifest.fixtureSha256);
      const queries = createProductQueryService(repository);
      const story = queries.getSupplyChainStory("generic-smartphone")!;
      expect(story.nodes).toHaveLength(45);
      expect(story.flows).toHaveLength(46);
      expect(story.nodes.some((record) => record.node.period.label === "2026-09")).toBe(true);
      expect(story.nodes.some((record) => record.node.period.label === "2025")).toBe(true);
      expect(queries.getProductResearchExport("generic-smartphone")!.recordCounts.manufacturingProcessSteps).toBe(32);
    } finally { await rm(directory, { recursive: true, force: true }); }
    expect(first.audit.sourceAudit).toHaveLength(17);
    expect(first.audit.addedFlows).toBe(33);
    expect(first.audit.processStepsAdded).toBe(14);
  });

  it("connects every major component to China assembly through actual graph paths", async () => {
    const { fixture } = await buildPhoneBranches();
    const nodes = fixture.storyGraph.nodes;
    const descendants = (rootId: string): Set<string> => {
      const ids = new Set([rootId]);
      for (let index = 0; index < fixture.items.length; index++) for (const item of fixture.items) if (ids.has(item.parentItemId)) ids.add(item.id);
      return ids;
    };
    const reachesAssembly = (start: string): boolean => {
      const seen = new Set([start]);
      for (let index = 0; index < nodes.length; index++) for (const flow of fixture.storyGraph.flows) if (seen.has(flow.fromEntityId)) seen.add(flow.toEntityId);
      return seen.has("node-cn-assembly");
    };
    expect(topComponents).toHaveLength(7);
    for (const component of topComponents) {
      const ids = descendants(component);
      const relevant = nodes.filter((node: { itemId: string }) => ids.has(node.itemId));
      expect(relevant.some((node: { id: string }) => reachesAssembly(node.id)), component).toBe(true);
    }
    for (const nodeId of ["node-tw-wafer", "node-image-sensor-catalog", "node-bare-pcb", "node-cn-frame-material", "node-cn-microphone", "node-cn-battery-pack", "node-display-panel-catalog"]) expect(reachesAssembly(nodeId), nodeId).toBe(true);
  });

  it("keeps trade and existing macro records intact, with no invented flows or quantities", async () => {
    const { fixture } = await buildPhoneBranches();
    for (const key of ["tradeObservations", "materialTradeObservations", "evidenceGaps"] as const) expect(withoutDataset(fixture[key])).toEqual(withoutDataset(baseline[key]));
    expect(withoutDataset(fixture.macroIndicators.slice(0, baseline.macroIndicators.length))).toEqual(withoutDataset(baseline.macroIndicators));
    expect(fixture.storyGraph.flows.every((flow: { evidenceLevel: string; value: null; quantity: null; quantityDataStatus: string }) => flow.evidenceLevel === "representative" && flow.value === null && flow.quantity === null && flow.quantityDataStatus === "unknown")).toBe(true);
    expect(fixture.tradeObservations).toHaveLength(24);
    expect(fixture.materialTradeObservations).toHaveLength(62);
  });

  it("retains true source periods, precise smartphone output scope and the unresolved Korean module", async () => {
    const { fixture, audit } = await buildPhoneBranches();
    const byId = new Map(fixture.storyGraph.nodes.map((node: { id: string }) => [node.id, node]));
    expect(byId.get("node-tw-wafer").period.label).toBe("2025");
    expect(byId.get("node-vn-assembly").period.label).toBe("2024");
    expect(byId.get("node-in-assembly").period.label).toBe("2023");
    expect(byId.get("node-display-module-catalog").period.label).toBe("2026-09");
    expect(byId.get("node-cn-graphite-treatment").period.label).toBe("2026-10");
    expect(fixture.productionActivities.filter((activity: { dataStatus: string }) => activity.dataStatus === "unknown").map((activity: { id: string }) => activity.id)).toEqual(["activity-kr-module"]);
    expect(audit.remainingUnknownActivities).toEqual(["activity-kr-module"]);
    const output = audit.reviewedUnpublishedIndicators[0];
    expect(output.quantity).toBe(1140000000);
    expect(output.unit).toBe("items");
    expect(output.period.label).toBe("2023");
    expect(output.notes).toContain("规模以上");
    expect(output.notes).toContain("智能手机");
    expect(fixture.macroIndicators).toHaveLength(baseline.macroIndicators.length);
  });

  it("publishes useful process inputs and outputs, simple component descriptions and source-linked evidence", async () => {
    const { fixture, config } = await buildPhoneBranches();
    const chainIds = new Set(config.manufacturingChains.map((chain: { id: string }) => chain.id));
    const steps = fixture.manufacturingProcessSteps.filter((step: { processChainId: string }) => chainIds.has(step.processChainId));
    expect(steps).toHaveLength(14);
    for (const step of steps) {
      expect(step.inputItemIds.length).toBeGreaterThan(0);
      expect(step.outputItemIds.length).toBeGreaterThan(0);
      expect(step.sourceIds.length).toBeGreaterThan(1);
      expect(step.evidenceIds.length).toBeGreaterThan(1);
      expect(step.method).toBe("curated");
      expect(step.datasetVersionId).toBe(config.datasetVersionId);
    }
    expect(fixture.items.find((item: { id: string }) => item.id === "generic-smartphone").name).toBe("智能手机");
    for (const id of topComponents) expect(fixture.items.find((item: { id: string }) => item.id === id).description).not.toMatch(/示意|待验证|未验证|待补/);
    expect(fixture.storyGraph.nodes.some((node: { label: string }) => /代表性|角色|待补/.test(node.label))).toBe(false);
    const curation = fixture.evidence.find((record: { id: string }) => record.id === "evidence-phone-branches-curation-2026");
    expect(new Set(curation.scope.itemIds)).toEqual(new Set(fixture.items.map((item: { id: string }) => item.id)));
    for (const activity of config.activityUpdates) expect(fixture.productionActivities.find((record: { id: string }) => record.id === activity.id).notes.length).toBeLessThan(30);
  });

  it("preserves immutable 2026.2 bytes", async () => {
    const { config } = await buildPhoneBranches();
    expect(hash(await readFile(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/fixture.json")))).toBe(config.baseFixtureSha256);
  });

  it("loads the immutable 2026.3 release and reproduces every published byte", async () => {
    const result = await buildPhoneBranches();
    const directory = resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.3");
    for (const [name, bytes] of Object.entries(result.files)) expect(await readFile(resolve(directory, name), "utf8")).toBe(bytes);
    const repository = await loadFixtureRepositoryFromManifest(resolve(directory, "manifest.json"));
    const fixture = repository.getProductFixture("generic-smartphone")!;
    expect(fixture.datasetVersion.version).toBe("globe-chain-smartphone-2026.3");
    expect(fixture.storyGraph.nodes).toHaveLength(45);
    expect(fixture.storyGraph.flows).toHaveLength(46);
    expect(fixture.manufacturingProcessSteps).toHaveLength(32);
    expect(result.manifest.fixtureSha256).toBe("96bed4ba8328ffc98d6046cdd53dea15e856cde8606e4c385f1918d5fc1f5ee2");
  });
});
