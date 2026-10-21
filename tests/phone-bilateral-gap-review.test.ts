import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProductFixture, loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";
import { buildPhoneGapReview, reviewBilateralClaim, verifyBilateralSnapshot } from "../scripts/build-phone-gap-review.mjs";
import baseline from "../data/published/releases/generic-smartphone/globe-chain-smartphone-2026.1/fixture.json";
import snapshot from "../data/published/raw/un-comtrade-hs2022-851713-bilateral-2023.json";
import review from "../content/reviews/smartphone-bilateral-gaps-2026-10-21.json";

const candidateManifest = resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json");
const immutableManifest = resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json");
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function remapDataset(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(remapDataset);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === "datasetVersionId" && child === baseline.datasetVersion.id ? review.datasetVersionId : remapDataset(child)]));
}

describe("2026.2 smartphone bilateral gap review", () => {
  it("rebuilds identical bytes and passes the complete fixture schema and published loader", async () => {
    const first = await buildPhoneGapReview();
    const second = await buildPhoneGapReview();
    expect(first.files).toEqual(second.files);
    expect(parseProductFixture(first.fixture).datasetVersion.version).toBe("globe-chain-smartphone-2026.2");
    const repository = await loadFixtureRepositoryFromManifest(candidateManifest);
    const fixture = repository.getProductFixture("generic-smartphone")!;
    expect(fixture.datasetVersion.status).toBe("published");
    expect(fixture.evidenceGaps.filter((gap) => gap.status === "closed")).toHaveLength(10);
    expect(fixture.evidenceGaps.filter((gap) => gap.status === "open")).toHaveLength(6);
    expect(hash(await readFile(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/fixture.json")))).toBe(first.manifest.fixtureSha256);
  });

  it("keeps all current statistics and every route record unchanged except dataset references", async () => {
    const { fixture } = await buildPhoneGapReview();
    for (const key of ["tradeObservations", "macroIndicators", "materialTradeObservations", "storyGraph", "items", "productionActivities", "manufacturingProcessChains", "manufacturingProcessSteps", "organizationCapabilities", "tariffMeasures"] as const) {
      expect(fixture[key]).toEqual(remapDataset(baseline[key]));
    }
    const targets = new Set(review.claims.map((claim) => claim.gapId));
    expect(fixture.evidenceGaps.filter((gap: { gapId: string }) => !targets.has(gap.gapId))).toEqual(remapDataset(baseline.evidenceGaps.filter((gap) => !targets.has(gap.gapId))));
    expect(fixture.storyGraph.flows.every((flow: { evidenceLevel: string; quantity: number | null; value: number | null }) => flow.evidenceLevel === "representative" && flow.quantity === null && flow.value === null)).toBe(true);
  });

  it("closes only the 2023 specific-partner observation claim and resolves its three evidence records", async () => {
    const queries = createProductQueryService(await loadFixtureRepositoryFromManifest(candidateManifest));
    for (const claim of review.claims) {
      const view = queries.getEvidenceGaps("generic-smartphone").find(({ gap }) => gap.gapId === claim.gapId)!;
      expect(view.gap.status).toBe("closed");
      expect(view.gap.currentEvidenceLevel).toBe("bilateral_supported");
      expect(view.gap.period.label).toBe("2023");
      expect(view.gap.evidenceIds).toEqual([claim.exportEvidenceId, claim.importEvidenceId, claim.mirrorEvidenceId]);
      expect(view.evidence.map(({ evidence }) => evidence.id)).toEqual(view.gap.evidenceIds);
      expect(view.contentVersion?.id).toBe(review.contentVersionId);
      expect(view.flow?.evidenceLevel.code).toBe("representative");
      expect(view.gap.currentClaim).toContain("HS 2022/851713");
      expect(view.gap.nonInferences.join(" ")).toContain("representative");
      expect(view.gap.missingEvidence).toContain("相关组装至市场路线仍为代表性连接");
    }
    expect(queries.getTradeNetwork("generic-smartphone")?.period.label).toBe("2024 / 2025");
    expect(queries.getSupplyChainStory("generic-smartphone")?.period.label).toBe("2023");
  });

  it("keeps the two mirror values independent and exposes their actual difference", async () => {
    const { audit } = await buildPhoneGapReview();
    for (let index = 0; index < review.claims.length; index++) {
      const claim = review.claims[index];
      const comparison = audit.comparisons[index];
      const exported = snapshot.bilateralResponses.find((entry) => entry.pairId === claim.exportPairId)!.payload.data.find((row) => row.flowCode === "X")!;
      const imported = snapshot.bilateralResponses.find((entry) => entry.pairId === claim.importPairId)!.payload.data.find((row) => row.flowCode === "M")!;
      expect(comparison.exportValue).toBe(exported.primaryValue);
      expect(comparison.importValue).toBe(imported.primaryValue);
      expect(comparison.differenceImportMinusExport).toBe(imported.primaryValue - exported.primaryValue);
      expect(comparison.exportValue).not.toBe(comparison.importValue);
      expect(comparison.currency).toBe("USD");
      expect(comparison.exportValuation).toBe("FOB");
      expect(comparison.importValuation).toBe("CIF");
    }
    expect(audit.comparisons[0].scopeNote).toContain("842");
    expect(audit.comparisons[0].scopeNote).toContain("840");
  });

  it("rejects world totals, another period, mismatched closing evidence, and raw corruption", () => {
    const claim = review.claims[0];
    const world = structuredClone(snapshot);
    world.bilateralResponses.find((entry) => entry.pairId === claim.exportPairId)!.payload.data.find((row) => row.flowCode === "X")!.partnerCode = 0;
    expect(() => reviewBilateralClaim(world, baseline, claim)).toThrow("scope");
    const anotherYear = structuredClone(snapshot);
    anotherYear.bilateralResponses.find((entry) => entry.pairId === claim.importPairId)!.payload.data.find((row) => row.flowCode === "M")!.refYear = 2024;
    expect(() => reviewBilateralClaim(anotherYear, baseline, claim)).toThrow("scope");
    const wrongEvidence = structuredClone(baseline);
    wrongEvidence.evidence.find((entry) => entry.id === claim.exportEvidenceId)!.scope!.toEntityId = "country-de";
    expect(() => reviewBilateralClaim(snapshot, wrongEvidence, claim)).toThrow("evidence scope/hash");
    const corrupt = structuredClone(snapshot);
    corrupt.bilateralResponses[0].payload.data[0].primaryValue += 1;
    expect(() => verifyBilateralSnapshot(corrupt)).toThrow("hash mismatch");
  });

  it("preserves the original 2026.1 immutable fixture bytes", async () => {
    expect(hash(await readFile(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.1/fixture.json")))).toBe(review.baseFixtureSha256);
  });

  it("loads the immutable 2026.2 output and matches its attached review audit", async () => {
    const fixture = (await loadFixtureRepositoryFromManifest(immutableManifest)).getProductFixture("generic-smartphone")!;
    const manifest = JSON.parse(await readFile(immutableManifest, "utf8"));
    const auditBytes = await readFile(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/review-audit.json"));
    expect(manifest.evidenceReview.auditSha256).toBe(hash(auditBytes));
    expect(fixture.evidenceGaps.filter((gap) => gap.contentVersionId === review.contentVersionId).map((gap) => gap.gapId)).toEqual(review.claims.map((claim) => claim.gapId));
  });
});
