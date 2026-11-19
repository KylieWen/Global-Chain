import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";
import { buildSmartphoneTradeHistory } from "../scripts/build-smartphone-trade-history.mjs";

const published = resolve("data/published");
const productId = "generic-smartphone";
const historyRelease = resolve(published, "releases", productId, "globe-chain-smartphone-2026.7");
const baseRelease = resolve(published, "releases", productId, "globe-chain-smartphone-2026.6");

describe("smartphone bilateral history release", () => {
  it("reproduces the immutable release and preserves the existing fixture with the new version binding", async () => {
    const { files, audit } = await buildSmartphoneTradeHistory();
    for (const [name, bytes] of Object.entries(files)) {
      expect(await readFile(resolve(historyRelease, name), "utf8")).toBe(bytes);
    }
    const baseline = JSON.parse(await readFile(resolve(baseRelease, "fixture.json"), "utf8"));
    const fixture = JSON.parse(files["fixture.json"]);
    expect(audit.addedObservationCount).toBe(12);
    expect(fixture.tradeObservations).toHaveLength(36);
    fixture.tradeObservations.splice(baseline.tradeObservations.length);
    fixture.datasetVersion = baseline.datasetVersion;
    expect(JSON.parse(JSON.stringify(fixture, (key, value) =>
      key === "datasetVersionId" && value === "dataset-smartphone-published-2026-7-trade-history"
        ? baseline.datasetVersion.id : value
    ))).toEqual(baseline);
  });

  it("exposes distinct CIF and FOB annual records through the published trade-map query", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve(historyRelease, "manifest.json"));
    const fixture = repository.getProductFixture(productId)!;
    const query = createProductQueryService(repository);
    const map = query.getTradeMapView(productId)!;
    expect(map.observations.filter(({ partnerScope }) => partnerScope === "entity")).toHaveLength(20);

    const usImports = fixture.tradeObservations.filter(({ reporterCode, partnerCode, flowCode }) =>
      reporterCode === 842 && partnerCode === 156 && flowCode === "M").sort((a, b) => a.period.label.localeCompare(b.period.label));
    expect(usImports.map(({ period, value, quantity }) => [period.label, value, quantity])).toEqual([
      ["2023", 45_203_156_861, 119_757_767], ["2024", 41_733_276_167, 117_658_392],
      ["2025", 23_682_589_324, 60_890_217],
    ]);
    expect(usImports.every(({ currency, quantityDataStatus }) => currency === "USD" && quantityDataStatus === "observed")).toBe(true);
    const chinaExports = fixture.tradeObservations.filter(({ reporterCode, partnerCode, flowCode }) =>
      reporterCode === 156 && partnerCode === 842 && flowCode === "X");
    expect(chinaExports.map(({ period }) => period.label).sort()).toEqual(["2023", "2024"]);
    expect(chinaExports.find(({ period }) => period.label === "2024")?.value).toBe(35_150_195_228);
    const germanImports = fixture.tradeObservations.filter(({ reporterCode, partnerCode, flowCode }) =>
      reporterCode === 276 && partnerCode === 156 && flowCode === "M");
    expect(germanImports.map(({ period }) => period.label).sort()).toEqual(["2023", "2024", "2025"]);
    expect(germanImports.every(({ unit, quantityDataStatus }) => unit === "items" && quantityDataStatus === "estimated")).toBe(true);
  });
});
