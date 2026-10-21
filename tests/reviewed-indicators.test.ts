import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ProductFixtureSchema } from "@globe-chain/contracts";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";
import { buildReviewedIndicators } from "../scripts/build-reviewed-indicators.mjs";
import baseline from "../data/published/releases/generic-smartphone/globe-chain-smartphone-2026.3/fixture.json";

const configPath = "content/indicators/smartphone-production-2026-10.json";
function omitVersion(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitVersion);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === "datasetVersionId" ? "VERSION" : omitVersion(child)]));
}

describe("reviewed physical indicator promotion", () => {
  it("rebuilds deterministically and loads the correct physical quantity and source", async () => {
    const result = await buildReviewedIndicators(configPath);
    expect((await buildReviewedIndicators(configPath)).files).toEqual(result.files);
    expect(ProductFixtureSchema.safeParse(result.fixture).success).toBe(true);
    const directory = await mkdtemp(resolve(tmpdir(), "globechain-indicators-"));
    try {
      for (const [name, bytes] of Object.entries(result.files)) await writeFile(resolve(directory, name), bytes as string);
      const repository = await loadFixtureRepositoryFromManifest(resolve(directory, "manifest.json"));
      const record = createProductQueryService(repository).getCountryLedger("generic-smartphone", "country-cn")!.resolvedMacroIndicators.find(view => view.observation.indicator === "smartphone_production_units")!;
      expect(record.measurement).toEqual({ kind: "quantity", value: 1140000000, currency: null, unit: "items" });
      expect(record.definition.displayUnit).toBe("台");
      expect(record.observation.period.label).toBe("2023");
      expect(record.source?.publisher).toContain("福建");
      expect(record.observation.notes).toContain("规模以上");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("preserves all prior statistics, route content and the immutable base", async () => {
    const { fixture } = await buildReviewedIndicators(configPath);
    expect(omitVersion(fixture.macroIndicators.slice(0, baseline.macroIndicators.length))).toEqual(omitVersion(baseline.macroIndicators));
    for (const key of ["tradeObservations", "materialTradeObservations", "storyGraph", "productionActivities", "manufacturingProcessSteps"] as const) expect(omitVersion(fixture[key])).toEqual(omitVersion(baseline[key]));
    expect(fixture.macroIndicators).toHaveLength(baseline.macroIndicators.length + 1);
    expect(JSON.parse(await readFile("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.3/fixture.json", "utf8"))).toEqual(baseline);
  });

  it("reproduces the immutable published indicator release", async () => {
    const result = await buildReviewedIndicators(configPath);
    for (const [name, bytes] of Object.entries(result.files)) expect(await readFile(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.4", name), "utf8")).toBe(bytes);
  });
});
