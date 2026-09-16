import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import smartphoneSample from "../data/samples/smartphone/fixture.json";
import publishedSmartphone from "../data/published/smartphone/fixture.json";
import {
  FixtureLoaderError,
  loadFixtureRepositoryFromManifest,
  parseProductFixture
} from "@globe-chain/db";
import {
  createInMemoryFixtureRepository,
  createProductQueryService
} from "@globe-chain/domain";

const publishedManifestPath = resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2023.16/manifest.json");

async function loadPublishedQueries() {
  const repository = await loadFixtureRepositoryFromManifest(publishedManifestPath, {
    allowedStatuses: ["published"]
  });
  return createProductQueryService(repository);
}

describe("phase 6 published data interpretation", () => {
  it("resolves China's four macro definitions and world-total smartphone trade", async () => {
    const queries = await loadPublishedQueries();
    const ledger = queries.getCountryLedger("generic-smartphone", "country-cn", {
      label: "2023",
      itemId: "generic-smartphone"
    });

    expect(ledger?.resolvedMacroIndicators).toHaveLength(4);
    expect(ledger?.resolvedMacroIndicators.map((view) => view.definition.label)).toEqual([
      "商品出口总额",
      "商品进口总额",
      "商品贸易差额",
      "官方储备总额（含黄金）"
    ]);
    expect(ledger?.resolvedMacroIndicators[0].definition.sourceIndicatorCode).toBe(
      "TX.VAL.MRCH.CD.WT"
    );
    expect(ledger?.resolvedMacroIndicators[0].definition.statisticalConcept).toBe("customs");
    expect(ledger?.resolvedMacroIndicators[0].source?.publisher).toBe("World Bank");
    const worldTotalTrade = ledger?.resolvedTradeObservations.filter(
      (view) => view.partnerScope === "world_total"
    );
    expect(worldTotalTrade).toHaveLength(2);
    expect(
      worldTotalTrade?.every(
        (view) =>
          view.partnerScope === "world_total" &&
          view.observation.partnerCode === 0 &&
          view.partner === null
      )
    ).toBe(true);
    expect(worldTotalTrade?.[0].classification?.code).toBe("851713");
    expect(worldTotalTrade?.[0].classification?.version).toBe("2022");
    expect(worldTotalTrade?.[0].source?.name).toContain("UN Comtrade");
    expect(
      worldTotalTrade?.every(
        (view) =>
          view.observation.valueDataStatus === "observed" &&
          view.observation.quantityDataStatus === "observed" &&
          typeof view.observation.quantity === "number"
      )
    ).toBe(true);
  });

  it("preserves Japan's negative derived trade balance and independent quantity status", async () => {
    const queries = await loadPublishedQueries();
    const ledger = queries.getCountryLedger("generic-smartphone", "country-jp", {
      label: "2023",
      itemId: "generic-smartphone"
    });
    const balance = ledger?.resolvedMacroIndicators.find(
      (view) => view.observation.indicator === "merchandise_trade_balance_current_usd"
    );

    expect(balance?.observation.value).toBe(-69_943_000_000);
    expect(balance?.observation.method).toBe("derived");
    expect(balance?.definition.formula).toBe("商品贸易差额 = 商品出口总额 - 商品进口总额");
    expect(balance?.observation.notes).toContain("macro-jpn-merchandise-exports");
    expect(balance?.observation.notes).toContain("macro-jpn-merchandise-imports");
    expect(balance?.observation.notes).toContain("No additional rounding is applied");
    expect(ledger?.resolvedTradeObservations.every((view) => view.observation.dataStatus === "observed")).toBe(true);
    expect(ledger?.resolvedTradeObservations.every((view) => view.observation.quantityDataStatus === "observed")).toBe(true);
    expect(ledger?.resolvedTradeObservations.every((view) => typeof view.observation.quantity === "number")).toBe(true);
  });

  it("keeps United States source metadata and Comtrade estimation flags", async () => {
    const queries = await loadPublishedQueries();
    const ledger = queries.getCountryLedger("generic-smartphone", "country-us", {
      label: "2023",
      itemId: "generic-smartphone"
    });
    const wdi = ledger?.resolvedMacroIndicators[0].source;

    expect(wdi?.publisher).toBe("World Bank");
    expect(wdi?.retrievedAt).toMatch(/^2026-08-24T/);
    expect(wdi?.datasetVersion).toBe("WDI-2026-07-13");
    const worldTotalTrade = ledger?.resolvedTradeObservations.filter(
      (view) => view.partnerScope === "world_total"
    );
    expect(worldTotalTrade).toHaveLength(2);
    expect(worldTotalTrade?.every((view) => view.observation.dataStatus === "observed")).toBe(true);
    expect(worldTotalTrade?.every((view) => view.observation.quantityDataStatus === "observed")).toBe(true);
    expect(worldTotalTrade?.every((view) => typeof view.observation.quantity === "number")).toBe(true);
    expect(worldTotalTrade?.every((view) => view.observation.qualityNote?.includes("legacyEstimationFlag"))).toBe(true);
  });

  it("withholds source-estimated quantities without marking monetary values as estimated", async () => {
    const queries = await loadPublishedQueries();
    const ledger = queries.getCountryLedger("generic-smartphone", "country-de", {
      label: "2023",
      itemId: "generic-smartphone"
    });

    const worldTotalTrade = ledger?.resolvedTradeObservations.filter(
      (view) => view.partnerScope === "world_total"
    );
    expect(worldTotalTrade).toHaveLength(2);
    expect(worldTotalTrade?.every((view) => view.observation.dataStatus === "observed")).toBe(true);
    expect(worldTotalTrade?.every((view) => view.observation.quantityDataStatus === "estimated")).toBe(true);
    expect(worldTotalTrade?.every((view) => view.observation.quantity === null)).toBe(true);
    expect(worldTotalTrade?.every((view) => view.observation.unit === "items")).toBe(true);
  });

  it("treats the missing DRC Comtrade rows as unknown availability, never as zero", async () => {
    const queries = await loadPublishedQueries();
    const ledger = queries.getCountryLedger("generic-smartphone", "country-cd", {
      label: "2023",
      itemId: "generic-smartphone"
    });

    expect(ledger?.resolvedMacroIndicators).toHaveLength(4);
    expect(ledger?.tradeObservations).toHaveLength(0);
    expect(ledger?.resolvedTradeObservations).toHaveLength(0);
    expect(ledger?.tradeClassifications[0]).toMatchObject({
      system: "HS",
      version: "2022",
      code: "851713"
    });
    expect(ledger?.tradeAvailability).toBe("unknown");
    expect(ledger?.tradeAvailabilityNote).toContain("不表示贸易额为 0");
    expect(ledger?.tradeObservations.some((observation) => observation.value === 0)).toBe(false);
  });

  it("returns complete provenance definitions, query URLs, licences and missing-data notes", async () => {
    const queries = await loadPublishedQueries();
    const provenance = queries.getProvenance("generic-smartphone");
    const wdi = provenance?.sources.find((source) => source.id === "source-world-bank-wdi");
    const comtrade = provenance?.sources.find((source) => source.id === "source-un-comtrade");

    expect(provenance?.indicatorDefinitions).toHaveLength(4);
    expect(
      provenance?.indicatorDefinitions.map((definition) => definition.sourceIndicatorCode)
    ).toEqual(expect.arrayContaining([
      "TX.VAL.MRCH.CD.WT",
      "TM.VAL.MRCH.CD.WT",
      "FI.RES.TOTL.CD"
    ]));
    expect(comtrade?.url).toContain("cmdCode=851713");
    expect(comtrade?.url).toContain("partnerCode=0");
    expect(comtrade?.license).toContain("not CC BY");
    expect(wdi?.license).toContain("CC BY 4.0");
    expect(wdi?.retrievedAt).toBeTruthy();
    expect(provenance?.missingDataNotes.some((note) => note.includes("刚果民主共和国"))).toBe(true);
    expect(provenance?.missingDataNotes.some((note) => note.includes("含黄金"))).toBe(true);
    expect(provenance?.missingDataNotes.some((note) => note.includes("企业利润"))).toBe(true);
    expect(provenance?.missingDataNotes.some((note) => note.includes("isQtyEstimated"))).toBe(true);
  });

  it("keeps old mock fixtures compatible and falls back without page hard-coding", () => {
    const parsed = parseProductFixture(structuredClone(smartphoneSample));
    const queries = createProductQueryService(createInMemoryFixtureRepository([parsed]));
    const ledger = queries.getCountryLedger("generic-smartphone", "country-cn", {
      label: "2023"
    });

    expect(parsed.indicatorDefinitions).toEqual([]);
    expect(parsed.missingDataNotes).toEqual([]);
    expect(ledger?.resolvedMacroIndicators.length).toBeGreaterThan(0);
    expect(ledger?.resolvedMacroIndicators.every((view) => view.definition.metadataStatus === "fallback")).toBe(true);
    expect(ledger?.resolvedMacroIndicators[0].definition.label).toBe(
      ledger?.resolvedMacroIndicators[0].observation.indicator
    );
  });

  it("preserves a true observed zero separately from an unknown null", () => {
    const fixture = structuredClone(smartphoneSample) as Record<string, unknown> & {
      tradeObservations: Array<Record<string, unknown>>;
    };
    const unknown = fixture.tradeObservations.find(
      (observation) => observation.reporterEntityId === "country-cn"
    );
    if (!unknown) throw new Error("Expected a China mock trade observation");
    fixture.tradeObservations.push({
      ...unknown,
      id: "trade-cn-observed-zero",
      value: 0,
      currency: "USD",
      dataStatus: "observed"
    });
    const parsed = parseProductFixture(fixture);
    const queries = createProductQueryService(createInMemoryFixtureRepository([parsed]));
    const ledger = queries.getCountryLedger("generic-smartphone", "country-cn", {
      label: "2023"
    });

    const zero = ledger?.tradeObservations.find((observation) => observation.id === "trade-cn-observed-zero");
    const missing = ledger?.tradeObservations.find((observation) => observation.id !== "trade-cn-observed-zero");
    expect(zero?.value).toBe(0);
    expect(zero?.dataStatus).toBe("observed");
    expect(missing?.value).toBeNull();
    expect(missing?.dataStatus).toBe("unknown");
  });

  it("rejects duplicate or broken indicator-definition references", () => {
    const duplicate = structuredClone(publishedSmartphone) as Record<string, unknown> & {
      indicatorDefinitions: Array<Record<string, unknown>>;
    };
    duplicate.indicatorDefinitions.push({ ...duplicate.indicatorDefinitions[0], id: "duplicate-definition" });
    try {
      parseProductFixture(duplicate);
      throw new Error("Expected duplicate definition validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(FixtureLoaderError);
      expect((error as FixtureLoaderError).issues?.join("\n")).toContain(
        "Indicator definition keys must be unique"
      );
    }

    const brokenSource = structuredClone(publishedSmartphone) as Record<string, unknown> & {
      indicatorDefinitions: Array<Record<string, unknown>>;
    };
    brokenSource.indicatorDefinitions[0].sourceIds = ["missing-source"];
    try {
      parseProductFixture(brokenSource);
      throw new Error("Expected broken source validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(FixtureLoaderError);
      expect((error as FixtureLoaderError).issues?.join("\n")).toContain(
        "references an unknown source"
      );
    }
  });

  it("rejects contradictory missing-value and partner-scope semantics", () => {
    const unknownZero = structuredClone(publishedSmartphone) as Record<string, unknown> & {
      tradeObservations: Array<Record<string, unknown>>;
    };
    unknownZero.tradeObservations[0].dataStatus = "unknown";
    unknownZero.tradeObservations[0].valueDataStatus = "unknown";
    try {
      parseProductFixture(unknownZero);
      throw new Error("Expected unknown numeric value validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(FixtureLoaderError);
      expect((error as FixtureLoaderError).issues?.join("\n")).toContain(
        "unknown monetary values must be null"
      );
    }

    const unknownMacroZero = structuredClone(publishedSmartphone) as Record<string, unknown> & {
      macroIndicators: Array<Record<string, unknown>>;
    };
    unknownMacroZero.macroIndicators[0].dataStatus = "unknown";
    unknownMacroZero.macroIndicators[0].value = 0;
    try {
      parseProductFixture(unknownMacroZero);
      throw new Error("Expected unknown macro zero validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(FixtureLoaderError);
      expect((error as FixtureLoaderError).issues?.join("\n")).toContain(
        "unknown macro values must be null"
      );
    }

    const contradictoryPartner = structuredClone(publishedSmartphone) as Record<string, unknown> & {
      tradeObservations: Array<Record<string, unknown>>;
    };
    contradictoryPartner.tradeObservations[0].partnerScope = "entity";
    try {
      parseProductFixture(contradictoryPartner);
      throw new Error("Expected partner-scope validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(FixtureLoaderError);
      expect((error as FixtureLoaderError).issues?.join("\n")).toContain(
        "Entity partner scope requires partnerEntityId"
      );
    }
  });
});
