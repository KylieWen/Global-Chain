import { describe, expect, it } from "vitest";
import { MaterialTradeObservationSchema } from "@globe-chain/contracts";
import fixture from "../data/published/smartphone/fixture.json";

describe("phase 9 material trade observations", () => {
  const observations = fixture.materialTradeObservations;

  it("keeps world totals separate from specific partners", () => {
    expect(observations.some((row) => row.partnerCode === 0 && row.partnerScope === "world_total" && row.partnerEntityId === null)).toBe(true);
    expect(observations.some((row) => row.partnerCode === 842 && row.partnerScope === "entity" && row.partnerEntityId)).toBe(true);
    expect(observations.every((row) => row.partnerCode !== 0 || row.partnerScope === "world_total")).toBe(true);
  });

  it("validates reusable material records and preserves classification limits", () => {
    for (const row of observations) expect(MaterialTradeObservationSchema.parse(row)).toEqual(row);
    expect(new Set(observations.map((row) => row.materialItemId))).toEqual(new Set(["copper", "aluminum", "lithium", "cobalt", "nickel", "graphite", "cathode-material", "anode-material"]));
    expect(observations.filter((row) => row.classificationMappingType === "aggregate").every((row) => row.limitation.includes("不证明材料进入手机"))).toBe(true);
    expect(observations.every((row) => row.evidenceLevel === "bilateral_supported")).toBe(true);
  });

  it("does not turn estimated quantities or missing values into precise zeros", () => {
    expect(observations.filter((row) => row.quantityDataStatus === "estimated").every((row) => row.quantity === null)).toBe(true);
    expect(observations.filter((row) => row.valueDataStatus === "unknown").every((row) => row.value === null)).toBe(true);
  });
});
