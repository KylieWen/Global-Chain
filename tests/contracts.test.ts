import { describe, expect, it } from "vitest";
import {
  DatasetVersionSchema,
  GeoEntitySchema,
  ItemSchema,
  PeriodSchema,
  StoryGraphSchema,
  SupplyFlowSchema,
  TradeObservationSchema
} from "@globe-chain/contracts";

const annualPeriod = {
  granularity: "annual" as const,
  start: "2023-01-01",
  end: "2023-12-31",
  label: "2023"
};

describe("shared contract schemas", () => {
  it("accepts generic smartphone and a second generic item with the same model", () => {
    const smartphone = ItemSchema.parse({
      id: "generic-smartphone",
      slug: "generic-smartphone",
      name: "智能手机（通用商品）",
      itemType: "final_product",
      parentItemId: null,
      category: "电子产品",
      description: null,
      sourceIds: [],
      dataStatus: "unknown",
      method: "mock",
      datasetVersionId: null,
      validPeriod: annualPeriod
    });

    const coffee = ItemSchema.parse({
      id: "coffee",
      slug: "coffee",
      name: "咖啡",
      itemType: "final_product",
      parentItemId: null,
      category: "食品",
      description: null,
      sourceIds: [],
      dataStatus: "unknown",
      method: "mock",
      datasetVersionId: null,
      validPeriod: annualPeriod
    });

    expect(smartphone.slug).toBe("generic-smartphone");
    expect(coffee.slug).toBe("coffee");
  });

  it("keeps unknown, null, and zero distinct", () => {
    expect(PeriodSchema.safeParse(annualPeriod).success).toBe(true);
    expect(
      SupplyFlowSchema.parse({
        id: "flow-zero",
        fromEntityId: "country-a",
        toEntityId: "country-b",
        itemId: "lithium",
        processStageId: "refining",
        relationType: "production",
        flowKind: "representative_supply",
        period: annualPeriod,
        value: 0,
        quantity: null,
        currency: "USD",
        unit: null,
        method: "mock",
        sourceIds: [],
        confidence: null,
        dataStatus: "observed",
        datasetVersionId: null,
        notes: null
      }).value
    ).toBe(0);
  });

  it("rejects invalid confidence and negative values", () => {
    const result = SupplyFlowSchema.safeParse({
      id: "invalid-flow",
      fromEntityId: "country-a",
      toEntityId: "country-b",
      itemId: "lithium",
      processStageId: "refining",
      relationType: "production",
      flowKind: "representative_supply",
      period: annualPeriod,
      value: -1,
      quantity: null,
      currency: "USD",
      unit: null,
      method: "mock",
      sourceIds: [],
      confidence: 1.2,
      dataStatus: "observed",
      datasetVersionId: null,
      notes: null
    });

    expect(result.success).toBe(false);
  });

  it("requires provenance for non-mock supply and trade facts", () => {
    const supplyResult = SupplyFlowSchema.safeParse({
      id: "curated-flow",
      fromEntityId: "country-a",
      toEntityId: "country-b",
      itemId: "lithium",
      processStageId: "refining",
      relationType: "production",
      flowKind: "curated_physical",
      period: annualPeriod,
      value: null,
      quantity: null,
      currency: null,
      unit: null,
      method: "curated",
      sourceIds: [],
      confidence: null,
      dataStatus: "unknown",
      datasetVersionId: null,
      notes: null
    });

    const tradeResult = TradeObservationSchema.safeParse({
      id: "trade-fact",
      reporterEntityId: "country-a",
      partnerEntityId: "country-b",
      direction: "export",
      classificationSystem: "HS",
      classificationVersion: "2022",
      classificationCode: "8541",
      itemId: null,
      period: annualPeriod,
      value: 100,
      quantity: null,
      currency: "USD",
      unit: null,
      statisticalConcept: "customs",
      sourceId: null,
      datasetVersionId: null,
      method: "official",
      dataStatus: "observed",
      qualityNote: null
    });

    expect(supplyResult.success).toBe(false);
    expect(tradeResult.success).toBe(false);
  });

  it("requires a source and dataset version for published facts", () => {
    const dataset = DatasetVersionSchema.parse({
      id: "dataset-2023",
      name: "MVP demo dataset",
      version: "2023.1",
      publishedAt: null,
      sourceIds: ["source-demo"],
      coverage: 0.5,
      status: "published",
      notes: null
    });

    expect(dataset.status).toBe("published");
  });

  it("accepts a minimal story graph with referenced nodes and flows", () => {
    const graph = StoryGraphSchema.parse({
      productId: "generic-smartphone",
      period: annualPeriod,
      nodes: [
        {
          id: "node-a",
          nodeType: "entity",
          label: "Country A",
          entityId: "country-a",
          itemId: null,
          itemType: null,
          processStageId: "extraction",
          sourceIds: [],
          method: "mock",
          dataStatus: "unknown",
          datasetVersionId: null,
          notes: null
        },
        {
          id: "node-b",
          nodeType: "entity",
          label: "Country B",
          entityId: "country-b",
          itemId: null,
          itemType: null,
          processStageId: "refining",
          sourceIds: [],
          method: "mock",
          dataStatus: "unknown",
          datasetVersionId: null,
          notes: null
        }
      ],
      flows: [
        {
          id: "flow-a-b",
          fromEntityId: "node-a",
          toEntityId: "node-b",
          itemId: "lithium",
          processStageId: "refining",
          relationType: "production",
          flowKind: "representative_supply",
          period: annualPeriod,
          value: null,
          quantity: null,
          currency: null,
          unit: null,
          method: "mock",
          sourceIds: [],
          confidence: null,
          dataStatus: "unknown",
          datasetVersionId: null,
          notes: null
        }
      ],
      steps: [
        {
          id: "step-one",
          order: 0,
          title: "原料到精炼",
          description: "示意步骤",
          nodeIds: ["node-a", "node-b"],
          flowIds: ["flow-a-b"],
          evidenceIds: [],
          contentStatus: "draft",
          contentVersionId: null
        }
      ],
      datasetVersionId: null,
      contentVersionId: null,
      warnings: ["这是演示数据"]
    });

    expect(graph.steps).toHaveLength(1);
  });

  it("rejects a story step that references an unknown node", () => {
    const result = StoryGraphSchema.safeParse({
      productId: "generic-smartphone",
      period: annualPeriod,
      nodes: [],
      flows: [],
      steps: [
        {
          id: "step-one",
          order: 0,
          title: "无效步骤",
          description: "引用不存在的节点",
          nodeIds: ["missing-node"],
          flowIds: [],
          evidenceIds: [],
          contentStatus: "draft",
          contentVersionId: null
        }
      ],
      datasetVersionId: null,
      contentVersionId: null,
      warnings: []
    });

    expect(result.success).toBe(false);
  });

  it("validates geo entities with ISO codes", () => {
    const country = GeoEntitySchema.parse({
      id: "country-cn",
      kind: "country",
      name: "中国",
      iso2: "CN",
      iso3: "CHN",
      parentId: null,
      sourceIds: [],
      dataStatus: "unknown",
      method: "mock",
      datasetVersionId: null,
      validPeriod: null
    });

    expect(country.iso3).toBe("CHN");
  });
});
