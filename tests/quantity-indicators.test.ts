import { describe, expect, it } from "vitest";
import { MacroIndicatorObservationSchema, ProductFixtureSchema } from "@globe-chain/contracts";
import { createInMemoryFixtureRepository, createProductQueryService } from "@globe-chain/domain";
import baseline from "../data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/fixture.json";

const quantityRecord = {
  ...baseline.macroIndicators[0], id: "macro-production-count", indicator: "production_count",
  entityId: "country-cn", value: null, quantity: 1234567, currency: null, unit: "items",
  dataStatus: "observed" as const
};

describe("physical quantity indicators", () => {
  it("accepts production without a currency, while validating zero and units", () => {
    expect(MacroIndicatorObservationSchema.parse(quantityRecord).quantity).toBe(1234567);
    expect(MacroIndicatorObservationSchema.parse({ ...quantityRecord, quantity: 0 }).quantity).toBe(0);
    expect(MacroIndicatorObservationSchema.safeParse({ ...quantityRecord, quantity: null }).success).toBe(false);
    expect(MacroIndicatorObservationSchema.safeParse({ ...quantityRecord, unit: null }).success).toBe(false);
    expect(MacroIndicatorObservationSchema.safeParse({ ...quantityRecord, quantity: -1 }).success).toBe(false);
  });

  it("keeps monetary requirements and forbids numbers on unknown or withheld records", () => {
    expect(MacroIndicatorObservationSchema.safeParse({ ...quantityRecord, value: 100, quantity: null }).success).toBe(false);
    for (const dataStatus of ["unknown", "withheld"] as const) {
      expect(MacroIndicatorObservationSchema.safeParse({ ...quantityRecord, dataStatus, quantity: 0 }).success).toBe(false);
      expect(MacroIndicatorObservationSchema.safeParse({ ...quantityRecord, dataStatus, quantity: null }).success).toBe(true);
    }
    expect(MacroIndicatorObservationSchema.safeParse({ ...quantityRecord, dataStatus: "estimated" }).success).toBe(true);
  });

  it("resolves numbers and sources through the generic country ledger", () => {
    const missingMoney = { ...quantityRecord, id: "macro-missing-money", indicator: "missing_money", quantity: null, currency: "USD", unit: "current USD", dataStatus: "unknown" };
    const fixture = ProductFixtureSchema.parse({ ...baseline, macroIndicators: [...baseline.macroIndicators, quantityRecord, missingMoney] });
    const queries = createProductQueryService(createInMemoryFixtureRepository([fixture]));
    const records = queries.getCountryLedger(fixture.productId, "country-cn")!.resolvedMacroIndicators;
    const production = records.find(record => record.observation.id === quantityRecord.id)!;
    expect(production.measurement).toEqual({ kind: "quantity", value: 1234567, unit: "items", currency: null });
    expect(production.source?.id).toBe(quantityRecord.sourceId);
    expect(records.find(record => record.observation.id === missingMoney.id)?.measurement).toEqual({ kind: "monetary", value: null, currency: "USD", unit: "current USD" });
    expect(records.filter(record => record.measurement.kind === "monetary").every(record => record.measurement.value === record.observation.value && record.measurement.currency === record.observation.currency)).toBe(true);
  });
});
