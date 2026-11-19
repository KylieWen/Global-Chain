import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ProductFixtureSchema } from "../packages/contracts/src/index";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const config = read("content/data-refresh/industry-content-expansion-2026-10-24.json");
const expansionVersions: Record<string, string> = {
  "generic-smartphone": "globe-chain-smartphone-2026.6",
  "generic-cotton-tshirt": "globe-chain-cotton-tshirt-2026.3",
  "generic-soybean-oil": "globe-chain-soybean-oil-2026.3",
  "generic-electric-bicycle": "globe-chain-electric-bicycle-2026.3",
  "generic-home-air-conditioner": "globe-chain-home-air-conditioner-2026.6",
};

describe("source-preserving industry content expansion", () => {
  it("makes all five products deeply navigable without upgrading unknown process claims", () => {
    let added = 0;
    for (const baseline of config.fixtures) {
      const version = expansionVersions[baseline.productId];
      const fixture = ProductFixtureSchema.parse(read(`data/published/releases/${baseline.productId}/${version}/fixture.json`));
      const before = read(`data/published/${baseline.path}`);
      expect(createHash("sha256").update(readFileSync(`data/published/${baseline.path}`)).digest("hex")).toBe(baseline.fixtureSha256);
      const network = fixture.industryNetwork!;
      expect(network.topics.length).toBeGreaterThan(20);
      expect(network.relations.length).toBeGreaterThan(20);
      const supported = new Set(before.manufacturingProcessSteps.filter((step: {dataStatus:string}) => step.dataStatus === "observed").map((step: {id:string}) => `technical-step-${step.id}`));
      for (const topic of network.topics.filter(topic => topic.id.startsWith("technical-step-"))) expect(supported.has(topic.id)).toBe(true);
      const omitVersion = (records: Record<string, unknown>[]) => records.map(({datasetVersionId: _version, ...record}) => record);
      expect(omitVersion(fixture.tradeObservations)).toEqual(omitVersion(before.tradeObservations));
      expect(omitVersion(fixture.macroIndicators)).toEqual(omitVersion(before.macroIndicators));
      added += network.topics.length - (before.industryNetwork?.topics.length ?? 0);
    }
    expect(added).toBeGreaterThanOrEqual(200);
  });
});
