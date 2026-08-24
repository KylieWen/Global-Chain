import { describe, expect, it } from "vitest";
import { ProductFixtureSchema } from "@globe-chain/contracts";
import coffeeJson from "../data/samples/coffee/fixture.json";
import smartphoneJson from "../data/samples/smartphone/fixture.json";

const smartphone = ProductFixtureSchema.parse(smartphoneJson);
const coffee = ProductFixtureSchema.parse(coffeeJson);

const allFactRecords = (fixture: typeof smartphone) => [
  ...fixture.entities,
  ...fixture.items,
  ...fixture.processStages,
  ...fixture.productionActivities,
  ...fixture.classificationCodes,
  ...fixture.classificationCrosswalks,
  ...fixture.storyGraph.nodes,
  ...fixture.storyGraph.flows,
  ...fixture.tradeObservations,
  ...fixture.macroIndicators
];

const assertUniqueIds = (values: Array<{ id: string }>) => {
  const ids = values.map((value) => value.id);
  expect(new Set(ids).size).toBe(ids.length);
};

describe("sample product fixtures", () => {
  it("validates smartphone and coffee with the same schema", () => {
    expect(smartphone.productId).toBe("generic-smartphone");
    expect(coffee.productId).toBe("coffee");
    expect(smartphone.items.some((item) => item.id === "battery")).toBe(true);
    expect(
      smartphone.storyGraph.nodes.some(
        (node) => node.itemId === "battery-module" && node.processStageId === "assembly"
      )
    ).toBe(true);
    expect(smartphone.storyGraph.flows.some((flow) => flow.itemId === "lithium")).toBe(true);
    expect(smartphone.storyGraph.flows.some((flow) => flow.itemId === "cobalt")).toBe(true);
    expect(smartphone.storyGraph.flows.some((flow) => flow.itemId === "nickel")).toBe(true);
    expect(smartphone.storyGraph.flows.some((flow) => flow.itemId === "graphite")).toBe(true);
    expect(smartphone.storyGraph.flows.some((flow) => flow.itemId === "copper")).toBe(true);
    expect(smartphone.storyGraph.flows.some((flow) => flow.itemId === "aluminum")).toBe(true);
  });

  it("keeps IDs unique and all fixture references resolvable", () => {
    for (const fixture of [smartphone, coffee]) {
      assertUniqueIds(fixture.sources);
      assertUniqueIds(fixture.evidence);
      assertUniqueIds(fixture.entities);
      assertUniqueIds(fixture.items);
      assertUniqueIds(fixture.processStages);
      assertUniqueIds(fixture.productionActivities);
      assertUniqueIds(fixture.classificationCodes);
      assertUniqueIds(fixture.classificationCrosswalks);
      assertUniqueIds(fixture.storyGraph.nodes);
      assertUniqueIds(fixture.storyGraph.flows);
      assertUniqueIds(fixture.storyGraph.steps);
      assertUniqueIds(fixture.tradeObservations);
      assertUniqueIds(fixture.macroIndicators);

      const itemIds = new Set(fixture.items.map((item) => item.id));
      const entityIds = new Set(fixture.entities.map((entity) => entity.id));
      const processStageIds = new Set(fixture.processStages.map((stage) => stage.id));
      const evidenceIds = new Set(fixture.evidence.map((evidence) => evidence.id));

      expect(itemIds.has(fixture.productId)).toBe(true);
      for (const item of fixture.items) {
        if (item.parentItemId) expect(itemIds.has(item.parentItemId)).toBe(true);
      }
      for (const activity of fixture.productionActivities) {
        expect(entityIds.has(activity.locationEntityId)).toBe(true);
        expect(processStageIds.has(activity.processStageId)).toBe(true);
        for (const itemId of [...activity.inputItemIds, ...activity.outputItemIds]) {
          expect(itemIds.has(itemId)).toBe(true);
        }
      }
      for (const step of fixture.storyGraph.steps) {
        for (const evidenceId of step.evidenceIds) expect(evidenceIds.has(evidenceId)).toBe(true);
      }
    }
  });

  it("marks every sample record as synthetic and unknown", () => {
    for (const fixture of [smartphone, coffee]) {
      expect(fixture.warnings.some((warning) => warning.includes("合成"))).toBe(true);
      for (const record of allFactRecords(fixture)) {
        expect(record.method).toBe("mock");
        expect(record.dataStatus).toBe("unknown");
      }
    }
  });

  it("does not turn unknown values into zero", () => {
    for (const fixture of [smartphone, coffee]) {
      const observations = [
        ...fixture.storyGraph.flows,
        ...fixture.tradeObservations,
        ...fixture.macroIndicators
      ];
      for (const observation of observations) {
        if (observation.dataStatus === "unknown") {
          expect(observation.value ?? null).toBeNull();
          expect(observation.quantity ?? null).toBeNull();
        }
      }
    }
  });

  it("rejects a dangling story flow item reference", () => {
    const invalid = structuredClone(smartphoneJson) as {
      storyGraph: { flows: Array<{ itemId: string }> };
    };
    invalid.storyGraph.flows[0].itemId = "missing-item";
    expect(ProductFixtureSchema.safeParse(invalid).success).toBe(false);
  });
});
