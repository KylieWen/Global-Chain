import { describe, expect, it } from "vitest";
import publishedSmartphoneJson from "../data/published/smartphone/fixture.json";
import smartphoneJson from "../data/samples/smartphone/fixture.json";
import {
  DatasetVersionSchema,
  EvidenceSchema,
  GeoEntitySchema,
  ItemSchema,
  PeriodSchema,
  ProductFixtureSchema,
  StoryGraphSchema,
  SupplyChainEvidenceLevelSchema,
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

  it("keeps unknown, null, and an observed zero distinct", () => {
    expect(PeriodSchema.safeParse(annualPeriod).success).toBe(true);
    const observedZero = SupplyFlowSchema.parse({
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
      dataStatus: "unknown",
      valueDataStatus: "observed",
      evidenceLevel: "representative",
      datasetVersionId: null,
      notes: null
    });

    expect(observedZero.value).toBe(0);
    expect(observedZero.dataStatus).toBe("unknown");
    expect(observedZero.valueDataStatus).toBe("observed");
    expect(observedZero.quantityDataStatus).toBe("unknown");
    expect(observedZero.evidenceLevel).toBe("representative");

    const contradictoryUnknownZero = SupplyFlowSchema.safeParse({
      ...observedZero,
      id: "flow-unknown-zero",
      valueDataStatus: "unknown"
    });
    expect(contradictoryUnknownZero.success).toBe(false);

    const contradictoryUnknownQuantityZero = SupplyFlowSchema.safeParse({
      ...observedZero,
      id: "flow-unknown-quantity-zero",
      value: null,
      currency: null,
      valueDataStatus: "unknown",
      quantity: 0,
      unit: "kg",
      quantityDataStatus: "unknown"
    });
    expect(contradictoryUnknownQuantityZero.success).toBe(false);
  });

  it("models evidence support type and supply-chain evidence level explicitly", () => {
    expect(SupplyChainEvidenceLevelSchema.options).toEqual([
      "role_supported",
      "bilateral_supported",
      "representative",
      "none"
    ]);
    expect(
      EvidenceSchema.parse({
        id: "evidence-role",
        sourceId: "source-one",
        supportType: "country_role",
        locator: "Country role table"
      }).supportType
    ).toBe("country_role");
    expect(
      EvidenceSchema.parse({
        id: "evidence-legacy",
        sourceId: "source-one",
        locator: "Legacy fixture locator"
      }).supportType
    ).toBe("process_context");
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
    expect(graph.method).toBe("mock");
    expect(graph.methodology).toEqual([]);
    expect(graph.limitations).toEqual([]);
    expect(graph.nodes[0].evidenceIds).toEqual([]);
    expect(graph.nodes[0].evidenceLevel).toBe("none");
    expect(graph.flows[0].valueDataStatus).toBe("unknown");
    expect(graph.flows[0].quantityDataStatus).toBe("unknown");
    expect(graph.steps[0].method).toBe("mock");
  });

  it("keeps legacy mock fixtures compatible while validating explicit evidence links", () => {
    const legacy = ProductFixtureSchema.parse(structuredClone(smartphoneJson));
    expect(legacy.contentVersions).toEqual([]);
    expect(legacy.evidence.every((record) => record.supportType === "process_context")).toBe(true);
    expect(legacy.storyGraph.nodes.every((node) => node.evidenceLevel === "none")).toBe(true);

    const mismatchedEvidenceSource = structuredClone(smartphoneJson) as Record<string, unknown> & {
      storyGraph: { nodes: Array<Record<string, unknown>> };
      evidence: Array<{ id: string }>;
    };
    mismatchedEvidenceSource.storyGraph.nodes[0].evidenceIds = [
      mismatchedEvidenceSource.evidence[0].id
    ];
    mismatchedEvidenceSource.storyGraph.nodes[0].sourceIds = [];
    expect(ProductFixtureSchema.safeParse(mismatchedEvidenceSource).success).toBe(false);
  });

  it("requires complete provenance and non-mock methods for published story records", () => {
    const published = structuredClone(smartphoneJson) as Record<string, unknown> & {
      datasetVersion: { status: string };
      storyGraph: {
        nodes: Array<Record<string, unknown>>;
        flows: Array<Record<string, unknown>>;
      };
    };
    published.datasetVersion.status = "published";
    published.storyGraph.nodes[0].method = "curated";

    const missingProvenance = ProductFixtureSchema.safeParse(published);
    expect(missingProvenance.success).toBe(false);
    if (missingProvenance.success) throw new Error("Expected published provenance validation to fail");
    expect(missingProvenance.error.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        "Published story node must define a period",
        "Published story node must reference evidence",
        "Published story node must reference a content version",
        "Published story graph must not use the mock method"
      ])
    );

    const entityEndpoint = structuredClone(smartphoneJson) as Record<string, unknown> & {
      datasetVersion: { status: string };
      storyGraph: { flows: Array<Record<string, unknown>> };
    };
    entityEndpoint.datasetVersion.status = "published";
    entityEndpoint.storyGraph.flows[0].fromEntityId = "country-au";
    const endpointResult = ProductFixtureSchema.safeParse(entityEndpoint);
    expect(endpointResult.success).toBe(false);
    if (endpointResult.success) throw new Error("Expected published endpoint validation to fail");
    expect(endpointResult.error.issues.map((issue) => issue.message)).toContain(
      "Published story flow source must reference a story node ID"
    );
  });

  it("keeps published evidence levels aligned with their cited support types", () => {
    const roleWithoutRoleEvidence = structuredClone(publishedSmartphoneJson) as Record<
      string,
      unknown
    > & {
      storyGraph: { nodes: Array<Record<string, unknown>>; flows: Array<Record<string, unknown>> };
    };
    roleWithoutRoleEvidence.storyGraph.nodes[0].evidenceLevel = "bilateral_supported";
    const bilateralResult = ProductFixtureSchema.safeParse(roleWithoutRoleEvidence);
    expect(bilateralResult.success).toBe(false);
    if (bilateralResult.success) throw new Error("Expected bilateral evidence validation to fail");
    expect(bilateralResult.error.issues.map((issue) => issue.message)).toContain(
      "Story node evidence level bilateral_supported requires bilateral_flow evidence"
    );

    const representativeWithoutCuration = structuredClone(publishedSmartphoneJson) as Record<
      string,
      unknown
    > & {
      storyGraph: { flows: Array<Record<string, unknown>> };
    };
    representativeWithoutCuration.storyGraph.flows[0].evidenceIds = [
      "evidence-usgs-australia-lithium-role",
      "evidence-iea-battery-chain"
    ];
    representativeWithoutCuration.storyGraph.flows[0].sourceIds = [
      "source-usgs-mineral-commodities",
      "source-iea-battery-supply-chain"
    ];
    const representativeResult = ProductFixtureSchema.safeParse(
      representativeWithoutCuration
    );
    expect(representativeResult.success).toBe(false);
    if (representativeResult.success) {
      throw new Error("Expected representative evidence validation to fail");
    }
    expect(representativeResult.error.issues.map((issue) => issue.message)).toContain(
      "Story flow evidence level representative requires curation_method evidence"
    );
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
