import { z } from "zod";
import {
  ClassificationCodeSchema,
  ClassificationCrosswalkSchema,
  GeoEntitySchema,
  ItemSchema,
  ProcessStageSchema,
  ProductionActivitySchema
} from "./catalog";
import {
  IndicatorDefinitionSchema,
  MacroIndicatorObservationSchema,
  TradeObservationSchema
} from "./observations";
import {
  ContentVersionSchema,
  DatasetVersionSchema,
  EvidenceSchema,
  SourceSchema
} from "./provenance";
import { IdSchema, NonEmptyStringSchema } from "./primitives";
import { StoryGraphSchema } from "./story";

export const ProductFixtureSchema = z
  .object({
    schemaVersion: NonEmptyStringSchema,
    productId: IdSchema,
    datasetVersion: DatasetVersionSchema,
    contentVersions: z.array(ContentVersionSchema).default([]),
    sources: z.array(SourceSchema),
    evidence: z.array(EvidenceSchema),
    entities: z.array(GeoEntitySchema),
    items: z.array(ItemSchema),
    processStages: z.array(ProcessStageSchema),
    productionActivities: z.array(ProductionActivitySchema),
    classificationCodes: z.array(ClassificationCodeSchema),
    classificationCrosswalks: z.array(ClassificationCrosswalkSchema),
    storyGraph: StoryGraphSchema,
    tradeObservations: z.array(TradeObservationSchema),
    macroIndicators: z.array(MacroIndicatorObservationSchema),
    /** Optional for backwards compatibility with draft/mock fixtures. */
    indicatorDefinitions: z.array(IndicatorDefinitionSchema).default([]),
    /** Human-readable release notes for known missing or semantically limited data. */
    missingDataNotes: z.array(NonEmptyStringSchema).default([]),
    warnings: z.array(NonEmptyStringSchema)
  })
  .superRefine((fixture, context) => {
    const sourceIdSet = new Set(fixture.sources.map((source) => source.id));
    const evidenceById = new Map(fixture.evidence.map((record) => [record.id, record]));
    const entityIds = new Set(fixture.entities.map((entity) => entity.id));
    const itemIds = new Set(fixture.items.map((item) => item.id));
    const processStageIds = new Set(fixture.processStages.map((stage) => stage.id));
    const storyNodeIds = new Set(fixture.storyGraph.nodes.map((node) => node.id));
    const classificationCodeIds = new Set(
      fixture.classificationCodes.map((classificationCode) => classificationCode.id)
    );
    const datasetVersionIds = new Set([fixture.datasetVersion.id]);
    const contentVersionIds = new Set(fixture.contentVersions.map((version) => version.id));

    const checkUnique = (values: string[], path: (string | number)[], label: string) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", path, message: `${label} IDs must be unique` });
      }
    };

    checkUnique(fixture.sources.map((source) => source.id), ["sources"], "Source");
    checkUnique(
      fixture.contentVersions.map((version) => version.id),
      ["contentVersions"],
      "Content version"
    );
    checkUnique(fixture.evidence.map((record) => record.id), ["evidence"], "Evidence");
    checkUnique(fixture.entities.map((entity) => entity.id), ["entities"], "Entity");
    checkUnique(fixture.items.map((item) => item.id), ["items"], "Item");
    checkUnique(fixture.processStages.map((stage) => stage.id), ["processStages"], "Process stage");
    checkUnique(
      fixture.productionActivities.map((activity) => activity.id),
      ["productionActivities"],
      "Production activity"
    );
    checkUnique(
      fixture.classificationCodes.map((classificationCode) => classificationCode.id),
      ["classificationCodes"],
      "Classification code"
    );
    checkUnique(
      fixture.classificationCrosswalks.map((mapping) => mapping.id),
      ["classificationCrosswalks"],
      "Classification crosswalk"
    );
    checkUnique(
      fixture.tradeObservations.map((observation) => observation.id),
      ["tradeObservations"],
      "Trade observation"
    );
    checkUnique(
      fixture.macroIndicators.map((observation) => observation.id),
      ["macroIndicators"],
      "Macro indicator"
    );
    checkUnique(
      fixture.indicatorDefinitions.map((definition) => definition.id),
      ["indicatorDefinitions"],
      "Indicator definition"
    );
    const indicatorKeys = fixture.indicatorDefinitions.map((definition) => definition.indicator);
    if (new Set(indicatorKeys).size !== indicatorKeys.length) {
      context.addIssue({
        code: "custom",
        path: ["indicatorDefinitions"],
        message: "Indicator definition keys must be unique"
      });
    }

    const checkSourceReferences = (
      sourceIds: string[],
      path: (string | number)[],
      label: string
    ) => {
      sourceIds.forEach((sourceId, sourceIndex) => {
        if (!sourceIdSet.has(sourceId)) {
          context.addIssue({
            code: "custom",
            path: [...path, sourceIndex],
            message: `${label} references an unknown source`
          });
        }
      });
    };

    const checkDatasetReference = (
      datasetVersionId: string | null | undefined,
      path: (string | number)[],
      label: string
    ) => {
      if (datasetVersionId && !datasetVersionIds.has(datasetVersionId)) {
        context.addIssue({
          code: "custom",
          path,
          message: `${label} references an unknown dataset version`
        });
      }
    };

    const checkContentVersionReference = (
      contentVersionId: string | null | undefined,
      path: (string | number)[],
      label: string
    ) => {
      if (contentVersionId && !contentVersionIds.has(contentVersionId)) {
        context.addIssue({
          code: "custom",
          path,
          message: `${label} references an unknown content version`
        });
      }
    };

    const checkEvidenceReferences = (
      recordEvidenceIds: string[],
      recordSourceIds: string[] | null,
      path: (string | number)[],
      label: string
    ) => {
      recordEvidenceIds.forEach((evidenceId, evidenceIndex) => {
        const evidence = evidenceById.get(evidenceId);
        if (!evidence) {
          context.addIssue({
            code: "custom",
            path: [...path, evidenceIndex],
            message: `${label} references unknown evidence`
          });
          return;
        }
        if (recordSourceIds && !recordSourceIds.includes(evidence.sourceId)) {
          context.addIssue({
            code: "custom",
            path: [...path, evidenceIndex],
            message: `${label} evidence source must be included in record.sourceIds`
          });
        }
      });
    };

    const checkSupplyEvidenceLevel = (
      record: {
        evidenceIds: readonly string[];
        evidenceLevel: "role_supported" | "bilateral_supported" | "representative" | "none";
      },
      path: (string | number)[],
      label: string
    ) => {
      const supportTypes = new Set(
        record.evidenceIds
          .map((evidenceId) => evidenceById.get(evidenceId)?.supportType)
          .filter((supportType): supportType is NonNullable<typeof supportType> => Boolean(supportType))
      );
      const requiredSupportType = ({
        role_supported: "country_role",
        bilateral_supported: "bilateral_flow",
        representative: "curation_method",
        none: null
      } as const)[record.evidenceLevel];

      if (requiredSupportType && !supportTypes.has(requiredSupportType)) {
        context.addIssue({
          code: "custom",
          path: [...path, "evidenceLevel"],
          message: `${label} evidence level ${record.evidenceLevel} requires ${requiredSupportType} evidence`
        });
      }
    };

    const requirePublishedStoryProvenance = (
      record: {
        method: string;
        period?: unknown;
        evidenceIds: readonly string[];
        evidenceLevel: "role_supported" | "bilateral_supported" | "representative" | "none";
        contentVersionId?: string | null;
      },
      path: (string | number)[],
      label: string
    ) => {
      if (fixture.datasetVersion.status !== "published") return;
      if (record.method === "mock") {
        context.addIssue({
          code: "custom",
          path: [...path, "method"],
          message: `Published ${label} must not use the mock method`
        });
      }
      if (!record.period) {
        context.addIssue({
          code: "custom",
          path: [...path, "period"],
          message: `Published ${label} must define a period`
        });
      }
      if (record.evidenceIds.length === 0) {
        context.addIssue({
          code: "custom",
          path: [...path, "evidenceIds"],
          message: `Published ${label} must reference evidence`
        });
      }
      if (record.evidenceLevel === "none") {
        context.addIssue({
          code: "custom",
          path: [...path, "evidenceLevel"],
          message: `Published ${label} must declare a supported or representative evidence level`
        });
      }
      if (!record.contentVersionId) {
        context.addIssue({
          code: "custom",
          path: [...path, "contentVersionId"],
          message: `Published ${label} must reference a content version`
        });
      }
    };

    const requirePublishedStoryStepProvenance = (
      step: {
        method: string;
        contentStatus: string;
        evidenceIds: readonly string[];
        contentVersionId?: string | null;
      },
      path: (string | number)[]
    ) => {
      if (fixture.datasetVersion.status !== "published") return;
      if (step.method === "mock") {
        context.addIssue({
          code: "custom",
          path: [...path, "method"],
          message: "Published story step must not use the mock method"
        });
      }
      if (step.contentStatus !== "published") {
        context.addIssue({
          code: "custom",
          path: [...path, "contentStatus"],
          message: "Published story step must have published content status"
        });
      }
      if (step.evidenceIds.length === 0) {
        context.addIssue({
          code: "custom",
          path: [...path, "evidenceIds"],
          message: "Published story step must reference evidence"
        });
      }
      if (!step.contentVersionId) {
        context.addIssue({
          code: "custom",
          path: [...path, "contentVersionId"],
          message: "Published story step must reference a content version"
        });
      }
    };

    fixture.datasetVersion.sourceIds.forEach((sourceId, sourceIndex) => {
      if (!sourceIdSet.has(sourceId)) {
        context.addIssue({
          code: "custom",
          path: ["datasetVersion", "sourceIds", sourceIndex],
          message: "Dataset version references an unknown source"
        });
      }
    });

    if (!itemIds.has(fixture.productId)) {
      context.addIssue({
        code: "custom",
        path: ["productId"],
        message: "Fixture productId must reference an item"
      });
    }

    fixture.entities.forEach((entity, index) => {
      if (entity.parentId && !entityIds.has(entity.parentId)) {
        context.addIssue({
          code: "custom",
          path: ["entities", index, "parentId"],
          message: "Entity references an unknown parent entity"
        });
      }
      checkSourceReferences(entity.sourceIds, ["entities", index, "sourceIds"], "Entity");
      checkDatasetReference(entity.datasetVersionId, ["entities", index, "datasetVersionId"], "Entity");
    });

    fixture.items.forEach((item, index) => {
      checkSourceReferences(item.sourceIds, ["items", index, "sourceIds"], "Item");
      checkDatasetReference(item.datasetVersionId, ["items", index, "datasetVersionId"], "Item");
    });

    fixture.processStages.forEach((stage, index) => {
      checkSourceReferences(stage.sourceIds, ["processStages", index, "sourceIds"], "Process stage");
      checkDatasetReference(
        stage.datasetVersionId,
        ["processStages", index, "datasetVersionId"],
        "Process stage"
      );
    });

    fixture.evidence.forEach((record, index) => {
      if (!sourceIdSet.has(record.sourceId)) {
        context.addIssue({
          code: "custom",
          path: ["evidence", index, "sourceId"],
          message: "Evidence references an unknown source"
        });
      }
    });

    fixture.items.forEach((item, index) => {
      if (item.parentItemId && !itemIds.has(item.parentItemId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "parentItemId"],
          message: "Item references an unknown parent item"
        });
      }
    });

    fixture.productionActivities.forEach((activity, index) => {
      if (!entityIds.has(activity.locationEntityId)) {
        context.addIssue({
          code: "custom",
          path: ["productionActivities", index, "locationEntityId"],
          message: "Production activity references an unknown entity"
        });
      }
      if (!processStageIds.has(activity.processStageId)) {
        context.addIssue({
          code: "custom",
          path: ["productionActivities", index, "processStageId"],
          message: "Production activity references an unknown process stage"
        });
      }
      [...activity.inputItemIds, ...activity.outputItemIds].forEach((itemId) => {
        if (!itemIds.has(itemId)) {
          context.addIssue({
            code: "custom",
            path: ["productionActivities", index],
            message: "Production activity references an unknown item"
          });
        }
      });
      checkSourceReferences(
        activity.sourceIds,
        ["productionActivities", index, "sourceIds"],
        "Production activity"
      );
      checkDatasetReference(
        activity.datasetVersionId,
        ["productionActivities", index, "datasetVersionId"],
        "Production activity"
      );
      checkEvidenceReferences(
        activity.evidenceIds,
        activity.sourceIds,
        ["productionActivities", index, "evidenceIds"],
        "Production activity"
      );
      checkSupplyEvidenceLevel(
        activity,
        ["productionActivities", index],
        "Production activity"
      );
      checkContentVersionReference(
        activity.contentVersionId,
        ["productionActivities", index, "contentVersionId"],
        "Production activity"
      );
      requirePublishedStoryProvenance(
        activity,
        ["productionActivities", index],
        "production activity"
      );
    });

    fixture.classificationCodes.forEach((classificationCode, index) => {
      checkSourceReferences(
        classificationCode.sourceIds,
        ["classificationCodes", index, "sourceIds"],
        "Classification code"
      );
      checkDatasetReference(
        classificationCode.datasetVersionId,
        ["classificationCodes", index, "datasetVersionId"],
        "Classification code"
      );
    });

    fixture.classificationCrosswalks.forEach((mapping, index) => {
      if (!itemIds.has(mapping.itemId)) {
        context.addIssue({
          code: "custom",
          path: ["classificationCrosswalks", index, "itemId"],
          message: "Classification crosswalk references an unknown item"
        });
      }
      if (!classificationCodeIds.has(mapping.classificationCodeId)) {
        context.addIssue({
          code: "custom",
          path: ["classificationCrosswalks", index, "classificationCodeId"],
          message: "Classification crosswalk references an unknown classification code"
        });
      }
      checkSourceReferences(
        mapping.sourceIds,
        ["classificationCrosswalks", index, "sourceIds"],
        "Classification crosswalk"
      );
      checkDatasetReference(
        mapping.datasetVersionId,
        ["classificationCrosswalks", index, "datasetVersionId"],
        "Classification crosswalk"
      );
    });

    fixture.storyGraph.nodes.forEach((node, index) => {
      if (node.entityId && !entityIds.has(node.entityId)) {
        context.addIssue({
          code: "custom",
          path: ["storyGraph", "nodes", index, "entityId"],
          message: "Story node references an unknown entity"
        });
      }
      if (node.itemId && !itemIds.has(node.itemId)) {
        context.addIssue({
          code: "custom",
          path: ["storyGraph", "nodes", index, "itemId"],
          message: "Story node references an unknown item"
        });
      }
      if (node.processStageId && !processStageIds.has(node.processStageId)) {
        context.addIssue({
          code: "custom",
          path: ["storyGraph", "nodes", index, "processStageId"],
          message: "Story node references an unknown process stage"
        });
      }
      checkSourceReferences(
        node.sourceIds,
        ["storyGraph", "nodes", index, "sourceIds"],
        "Story node"
      );
      checkDatasetReference(
        node.datasetVersionId,
        ["storyGraph", "nodes", index, "datasetVersionId"],
        "Story node"
      );
      checkEvidenceReferences(
        node.evidenceIds,
        node.sourceIds,
        ["storyGraph", "nodes", index, "evidenceIds"],
        "Story node"
      );
      checkSupplyEvidenceLevel(node, ["storyGraph", "nodes", index], "Story node");
      checkContentVersionReference(
        node.contentVersionId,
        ["storyGraph", "nodes", index, "contentVersionId"],
        "Story node"
      );
      requirePublishedStoryProvenance(node, ["storyGraph", "nodes", index], "story node");
    });

    fixture.storyGraph.flows.forEach((flow, index) => {
      if (fixture.datasetVersion.status === "published") {
        if (!storyNodeIds.has(flow.fromEntityId)) {
          context.addIssue({
            code: "custom",
            path: ["storyGraph", "flows", index, "fromEntityId"],
            message: "Published story flow source must reference a story node ID"
          });
        }
        if (!storyNodeIds.has(flow.toEntityId)) {
          context.addIssue({
            code: "custom",
            path: ["storyGraph", "flows", index, "toEntityId"],
            message: "Published story flow destination must reference a story node ID"
          });
        }
      }
      if (!itemIds.has(flow.itemId)) {
        context.addIssue({
          code: "custom",
          path: ["storyGraph", "flows", index, "itemId"],
          message: "Story flow references an unknown item"
        });
      }
      if (!processStageIds.has(flow.processStageId)) {
        context.addIssue({
          code: "custom",
          path: ["storyGraph", "flows", index, "processStageId"],
          message: "Story flow references an unknown process stage"
        });
      }
      checkSourceReferences(
        flow.sourceIds,
        ["storyGraph", "flows", index, "sourceIds"],
        "Story flow"
      );
      checkDatasetReference(
        flow.datasetVersionId,
        ["storyGraph", "flows", index, "datasetVersionId"],
        "Story flow"
      );
      checkEvidenceReferences(
        flow.evidenceIds,
        flow.sourceIds,
        ["storyGraph", "flows", index, "evidenceIds"],
        "Story flow"
      );
      checkSupplyEvidenceLevel(flow, ["storyGraph", "flows", index], "Story flow");
      checkContentVersionReference(
        flow.contentVersionId,
        ["storyGraph", "flows", index, "contentVersionId"],
        "Story flow"
      );
      requirePublishedStoryProvenance(flow, ["storyGraph", "flows", index], "story flow");
    });

    fixture.storyGraph.steps.forEach((step, index) => {
      checkEvidenceReferences(
        step.evidenceIds,
        null,
        ["storyGraph", "steps", index, "evidenceIds"],
        "Story step"
      );
      checkContentVersionReference(
        step.contentVersionId,
        ["storyGraph", "steps", index, "contentVersionId"],
        "Story step"
      );
      requirePublishedStoryStepProvenance(step, ["storyGraph", "steps", index]);
    });

    fixture.tradeObservations.forEach((observation, index) => {
      if (!entityIds.has(observation.reporterEntityId)) {
        context.addIssue({
          code: "custom",
          path: ["tradeObservations", index, "reporterEntityId"],
          message: "Trade observation references an unknown reporter entity"
        });
      }
      if (observation.partnerEntityId && !entityIds.has(observation.partnerEntityId)) {
        context.addIssue({
          code: "custom",
          path: ["tradeObservations", index, "partnerEntityId"],
          message: "Trade observation references an unknown partner entity"
        });
      }
      if (observation.sourceId && !sourceIdSet.has(observation.sourceId)) {
        context.addIssue({
          code: "custom",
          path: ["tradeObservations", index, "sourceId"],
          message: "Trade observation references an unknown source"
        });
      }
      if (observation.datasetVersionId && !datasetVersionIds.has(observation.datasetVersionId)) {
        context.addIssue({
          code: "custom",
          path: ["tradeObservations", index, "datasetVersionId"],
          message: "Trade observation references an unknown dataset version"
        });
      }
      if (observation.itemId && !itemIds.has(observation.itemId)) {
        context.addIssue({
          code: "custom",
          path: ["tradeObservations", index, "itemId"],
          message: "Trade observation references an unknown item"
        });
      }
    });

    fixture.macroIndicators.forEach((observation, index) => {
      if (!entityIds.has(observation.entityId)) {
        context.addIssue({
          code: "custom",
          path: ["macroIndicators", index, "entityId"],
          message: "Macro indicator references an unknown entity"
        });
      }
      if (observation.sourceId && !sourceIdSet.has(observation.sourceId)) {
        context.addIssue({
          code: "custom",
          path: ["macroIndicators", index, "sourceId"],
          message: "Macro indicator references an unknown source"
        });
      }
      if (observation.datasetVersionId && !datasetVersionIds.has(observation.datasetVersionId)) {
        context.addIssue({
          code: "custom",
          path: ["macroIndicators", index, "datasetVersionId"],
          message: "Macro indicator references an unknown dataset version"
        });
      }
    });

    fixture.indicatorDefinitions.forEach((definition, index) => {
      checkSourceReferences(
        definition.sourceIds,
        ["indicatorDefinitions", index, "sourceIds"],
        "Indicator definition"
      );
      checkDatasetReference(
        definition.datasetVersionId,
        ["indicatorDefinitions", index, "datasetVersionId"],
        "Indicator definition"
      );
    });

    checkContentVersionReference(
      fixture.storyGraph.contentVersionId,
      ["storyGraph", "contentVersionId"],
      "Story graph"
    );

    if (fixture.datasetVersion.status === "published") {
      if (fixture.storyGraph.method === "mock") {
        context.addIssue({
          code: "custom",
          path: ["storyGraph", "method"],
          message: "Published story graph must not use the mock method"
        });
      }
      if (!fixture.storyGraph.datasetVersionId) {
        context.addIssue({
          code: "custom",
          path: ["storyGraph", "datasetVersionId"],
          message: "Published story graph must reference a dataset version"
        });
      }
      if (!fixture.storyGraph.contentVersionId) {
        context.addIssue({
          code: "custom",
          path: ["storyGraph", "contentVersionId"],
          message: "Published story graph must reference a content version"
        });
      }
      if (
        fixture.storyGraph.method === "curated" &&
        (!fixture.storyGraph.representativeStatement ||
          fixture.storyGraph.methodology.length === 0 ||
          fixture.storyGraph.limitations.length === 0)
      ) {
        context.addIssue({
          code: "custom",
          path: ["storyGraph"],
          message: "Published curated story graph must explain its representative scope, methodology and limitations"
        });
      }
    }

    if (fixture.storyGraph.productId !== fixture.productId) {
      context.addIssue({
        code: "custom",
        path: ["storyGraph", "productId"],
        message: "Story graph productId must match fixture productId"
      });
    }
    if (
      fixture.storyGraph.datasetVersionId &&
      fixture.storyGraph.datasetVersionId !== fixture.datasetVersion.id
    ) {
      context.addIssue({
        code: "custom",
        path: ["storyGraph", "datasetVersionId"],
        message: "Story graph must reference the fixture dataset version"
      });
    }
  });

export type ProductFixture = z.infer<typeof ProductFixtureSchema>;
