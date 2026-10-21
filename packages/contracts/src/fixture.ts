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
  MaterialTradeObservationSchema,
  TradeObservationSchema
} from "./observations";
import {
  ContentVersionSchema,
  DatasetVersionSchema,
  EvidenceGapSchema,
  EvidenceSchema,
  SourceSchema
} from "./provenance";
import { IdSchema, NonEmptyStringSchema } from "./primitives";
import { StoryGraphSchema } from "./story";
import { IndustryNetworkSchema } from "./industry";
import {
  EquipmentCategorySchema,
  FacilitySchema,
  ManufacturingProcessChainSchema,
  ManufacturingRouteVariantSchema,
  ManufacturingProcessStepSchema,
  OrganizationCapabilitySchema,
  OrganizationSchema,
  ProcessRequirementSchema
} from "./manufacturing";
import {
  PolicyDocumentSchema,
  TariffMeasureSchema,
  TradeDocumentRequirementSchema,
  TradeGuideSchema,
  TradeProcedureSchema,
  TradeProcedureStepSchema,
  TradeRequirementSchema
} from "./trade-guidance";

export const ProductFixtureSchema = z
  .object({
    schemaVersion: NonEmptyStringSchema,
    productId: IdSchema,
    datasetVersion: DatasetVersionSchema,
    contentVersions: z.array(ContentVersionSchema).default([]),
    sources: z.array(SourceSchema),
    evidence: z.array(EvidenceSchema),
    evidenceGaps: z.array(EvidenceGapSchema).default([]),
    entities: z.array(GeoEntitySchema),
    items: z.array(ItemSchema),
    processStages: z.array(ProcessStageSchema),
    productionActivities: z.array(ProductionActivitySchema),
    classificationCodes: z.array(ClassificationCodeSchema),
    classificationCrosswalks: z.array(ClassificationCrosswalkSchema),
    storyGraph: StoryGraphSchema,
    tradeObservations: z.array(TradeObservationSchema),
    materialTradeObservations: z.array(MaterialTradeObservationSchema).default([]),
    macroIndicators: z.array(MacroIndicatorObservationSchema),
    /** Optional for backwards compatibility with draft/mock fixtures. */
    indicatorDefinitions: z.array(IndicatorDefinitionSchema).default([]),
    organizations: z.array(OrganizationSchema).default([]),
    facilities: z.array(FacilitySchema).default([]),
    manufacturingProcessChains: z.array(ManufacturingProcessChainSchema).default([]),
    manufacturingRouteVariants: z.array(ManufacturingRouteVariantSchema).default([]),
    manufacturingProcessSteps: z.array(ManufacturingProcessStepSchema).default([]),
    equipmentCategories: z.array(EquipmentCategorySchema).default([]),
    processRequirements: z.array(ProcessRequirementSchema).default([]),
    organizationCapabilities: z.array(OrganizationCapabilitySchema).default([]),
    industryNetwork: IndustryNetworkSchema.optional(),
    tradeGuides: z.array(TradeGuideSchema).default([]),
    tariffMeasures: z.array(TariffMeasureSchema).default([]),
    tradeRequirements: z.array(TradeRequirementSchema).default([]),
    tradeProcedures: z.array(TradeProcedureSchema).default([]),
    tradeProcedureSteps: z.array(TradeProcedureStepSchema).default([]),
    tradeDocumentRequirements: z.array(TradeDocumentRequirementSchema).default([]),
    policyDocuments: z.array(PolicyDocumentSchema).default([]),
    /** Human-readable release notes for known missing or semantically limited data. */
    missingDataNotes: z.array(NonEmptyStringSchema).default([]),
    warnings: z.array(NonEmptyStringSchema)
  })
  .superRefine((fixture, context) => {
    const sourceIdSet = new Set(fixture.sources.map((source) => source.id));
    if (fixture.industryNetwork) {
      const network = fixture.industryNetwork;
      if (!fixture.entities.some(entity => entity.id === network.regionEntityId)) context.addIssue({code:"custom",path:["industryNetwork"],message:"Unknown industry region"});
      for (const record of [network, ...network.topics, ...network.relations, ...network.organizations]) {
        if (record.datasetVersionId !== fixture.datasetVersion.id || record.sourceIds.some(id => !sourceIdSet.has(id))) context.addIssue({code:"custom",path:["industryNetwork"],message:"Invalid industry provenance"});
      }
    }
    const evidenceById = new Map(fixture.evidence.map((record) => [record.id, record]));
    const storyFlowIds = new Set(fixture.storyGraph.flows.map((flow) => flow.id));
    const entityIds = new Set(fixture.entities.map((entity) => entity.id));
    const itemIds = new Set(fixture.items.map((item) => item.id));
    const processStageIds = new Set(fixture.processStages.map((stage) => stage.id));
    const storyNodeIds = new Set(fixture.storyGraph.nodes.map((node) => node.id));
    const storyNodeById = new Map(fixture.storyGraph.nodes.map((node) => [node.id, node]));
    const classificationCodeIds = new Set(
      fixture.classificationCodes.map((classificationCode) => classificationCode.id)
    );
    const fixturePeriod = fixture.storyGraph.period;
    const datasetVersionIds = new Set([fixture.datasetVersion.id]);
    const contentVersionIds = new Set(fixture.contentVersions.map((version) => version.id));
    const organizationIds = new Set(fixture.organizations.map((organization) => organization.id));
    const processChainIds = new Set(fixture.manufacturingProcessChains.map((chain) => chain.id));
    const processStepIds = new Set(fixture.manufacturingProcessSteps.map((step) => step.id));
    const processRouteVariantIds = new Set(fixture.manufacturingRouteVariants.map((variant) => variant.id));
    const equipmentCategoryIds = new Set(fixture.equipmentCategories.map((equipment) => equipment.id));
    const tradeGuideIds = new Set(fixture.tradeGuides.map((guide) => guide.id));
    const tradeProcedureIds = new Set(fixture.tradeProcedures.map((procedure) => procedure.id));
    const tradeDocumentIds = new Set(fixture.tradeDocumentRequirements.map((document) => document.id));

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
    checkUnique(fixture.evidenceGaps.map((gap) => gap.gapId), ["evidenceGaps"], "Evidence gap");
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
    checkUnique(fixture.organizations.map((record) => record.id), ["organizations"], "Organization");
    checkUnique(fixture.facilities.map((record) => record.id), ["facilities"], "Facility");
    checkUnique(fixture.manufacturingProcessChains.map((record) => record.id), ["manufacturingProcessChains"], "Manufacturing process chain");
    checkUnique(fixture.manufacturingRouteVariants.map((record) => record.id), ["manufacturingRouteVariants"], "Manufacturing route variant");
    checkUnique(fixture.manufacturingProcessSteps.map((record) => record.id), ["manufacturingProcessSteps"], "Manufacturing process step");
    checkUnique(fixture.equipmentCategories.map((record) => record.id), ["equipmentCategories"], "Equipment category");
    checkUnique(fixture.processRequirements.map((record) => record.id), ["processRequirements"], "Process requirement");
    checkUnique(fixture.organizationCapabilities.map((record) => record.id), ["organizationCapabilities"], "Organization capability");
    checkUnique(fixture.tradeGuides.map((record) => record.id), ["tradeGuides"], "Trade guide");
    checkUnique(fixture.tariffMeasures.map((record) => record.id), ["tariffMeasures"], "Tariff measure");
    checkUnique(fixture.tradeRequirements.map((record) => record.id), ["tradeRequirements"], "Trade requirement");
    checkUnique(fixture.tradeProcedures.map((record) => record.id), ["tradeProcedures"], "Trade procedure");
    checkUnique(fixture.tradeProcedureSteps.map((record) => record.id), ["tradeProcedureSteps"], "Trade procedure step");
    checkUnique(fixture.tradeDocumentRequirements.map((record) => record.id), ["tradeDocumentRequirements"], "Trade document requirement");
    checkUnique(fixture.policyDocuments.map((record) => record.id), ["policyDocuments"], "Policy document");
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
        entityId?: string | null;
        locationEntityId?: string | null;
        fromEntityId?: string | null;
        toEntityId?: string | null;
        itemId?: string | null;
        processStageId?: string | null;
        period?: { granularity?: string; start: string; end: string } | null;
      },
      path: (string | number)[],
      label: string
    ) => {
      const supportTypes = new Set(
        record.evidenceIds
          .map((evidenceId) => evidenceById.get(evidenceId)?.supportType)
          .filter((supportType): supportType is NonNullable<typeof supportType> => Boolean(supportType))
      );
      const requiredSupportTypes = ({
        role_supported: ["country_role", "trade_observation"],
        bilateral_supported: ["bilateral_flow"],
        representative: ["curation_method"],
        none: []
      } as const)[record.evidenceLevel];

      if (
        requiredSupportTypes.length > 0 &&
        !requiredSupportTypes.some((supportType) => supportTypes.has(supportType))
      ) {
        context.addIssue({
          code: "custom",
          path: [...path, "evidenceLevel"],
          message:
            requiredSupportTypes.length === 1
              ? `${label} evidence level ${record.evidenceLevel} requires ${requiredSupportTypes[0]} evidence`
              : `${label} evidence level ${record.evidenceLevel} requires one of ${requiredSupportTypes.join(", ")} evidence`
        });
      }

      const supportingEvidence = record.evidenceIds
        .map((evidenceId) => evidenceById.get(evidenceId))
        .filter(
          (evidence) =>
            evidence &&
            (requiredSupportTypes as readonly string[]).includes(evidence.supportType) &&
            evidence.scope
        );
      if (fixture.datasetVersion.status !== "published" || requiredSupportTypes.length === 0) return;
      if (record.evidenceLevel === "representative") return;
      if (requiredSupportTypes.length > 0 && supportingEvidence.length === 0) {
        context.addIssue({
          code: "custom",
          path: [...path, "evidenceLevel"],
          message: `${label} evidence level ${record.evidenceLevel} requires structured matching evidence scope`
        });
        return;
      }
      let hasMatchingScope = false;

      // Story-flow endpoint fields historically use the name `fromEntityId`,
      // but published route content stores story-node IDs there. Evidence
      // scopes, on the other hand, always refer to geographic entity IDs.
      // Resolve both representations before comparing a bilateral claim so a
      // valid node-to-node claim is not rejected merely because the IDs live
      // at different layers. Draft/legacy fixtures may still use entity IDs
      // directly, which remains supported as a fallback.
      const resolveEndpointEntityId = (referenceId: string | null | undefined) => {
        if (!referenceId) return null;
        const node = storyNodeById.get(referenceId);
        if (node?.entityId) return node.entityId;
        return entityIds.has(referenceId) ? referenceId : null;
      };

      const itemMatchesScope = (
        recordItemId: string | null | undefined,
        scope: NonNullable<(typeof fixture.evidence)[number]["scope"]>
      ) => {
        if (!recordItemId) return true;
        if (scope.itemIds.includes(recordItemId)) return true;
        if (scope.classificationCodes.length === 0) return false;

        // A classification-only scope can match an item only through an
        // explicit exact crosswalk. Aggregate/approximate HS categories are
        // intentionally insufficient to promote a product-specific claim.
        const exactCodes = fixture.classificationCrosswalks
          .filter(
            (mapping) =>
              mapping.itemId === recordItemId &&
              mapping.mappingType === "exact" &&
              mapping.dataStatus !== "invalid"
          )
          .map((mapping) =>
            fixture.classificationCodes.find(
              (classification) => classification.id === mapping.classificationCodeId
            )
          )
          .filter((classification): classification is (typeof fixture.classificationCodes)[number] =>
            Boolean(classification)
          );
        return scope.classificationCodes.some((candidate) =>
          exactCodes.some(
            (classification) =>
              classification.system === candidate.system &&
              classification.version === candidate.version &&
              classification.code === candidate.code
          )
        );
      };

      for (const evidence of supportingEvidence) {
        const scope = evidence?.scope;
        if (!scope) continue;
        const recordPeriod = record.period ?? fixturePeriod;
        const periodMatches = Boolean(
          scope.period &&
          scope.period.start === recordPeriod.start &&
          scope.period.end === recordPeriod.end
        );
        if (record.evidenceLevel === "role_supported") {
          const recordEntityId = record.entityId ?? record.locationEntityId ?? null;
          const itemMatches = itemMatchesScope(record.itemId, scope);
          const stageMatches =
            !record.processStageId ||
            scope.processStageIds.length === 0 ||
            scope.processStageIds.includes(record.processStageId);
          hasMatchingScope ||= Boolean(
            recordEntityId &&
            scope.supportsCountryRole &&
            scope.entityIds.includes(recordEntityId) &&
            itemMatches &&
            stageMatches &&
            periodMatches
          );
        }
        if (record.evidenceLevel === "bilateral_supported") {
          const fromEntityId = resolveEndpointEntityId(record.fromEntityId);
          const toEntityId = resolveEndpointEntityId(record.toEntityId);
          hasMatchingScope ||= Boolean(
            scope.supportsBilateralFlow &&
            fromEntityId === scope.fromEntityId &&
            toEntityId === scope.toEntityId &&
            itemMatchesScope(record.itemId, scope) &&
            (!record.processStageId ||
              scope.processStageIds.length === 0 ||
              scope.processStageIds.includes(record.processStageId)) &&
            periodMatches
          );
        }
      }
      if (!hasMatchingScope) {
        context.addIssue({
          code: "custom",
          path: [...path, "evidenceLevel"],
          message: `${label} ${record.evidenceLevel} evidence scope must match its claim, entities, item, stage and period`
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

    fixture.evidenceGaps.forEach((gap, index) => {
      if (gap.nodeId && !storyNodeIds.has(gap.nodeId)) {
        context.addIssue({
          code: "custom",
          path: ["evidenceGaps", index, "nodeId"],
          message: "Evidence gap references an unknown story node"
        });
      }
      if (gap.flowId && !storyFlowIds.has(gap.flowId)) {
        context.addIssue({
          code: "custom",
          path: ["evidenceGaps", index, "flowId"],
          message: "Evidence gap references an unknown story flow"
        });
      }
      checkEvidenceReferences(
        gap.evidenceIds,
        null,
        ["evidenceGaps", index, "evidenceIds"],
        "Evidence gap"
      );
      checkDatasetReference(
        gap.datasetVersionId,
        ["evidenceGaps", index, "datasetVersionId"],
        "Evidence gap"
      );
      checkContentVersionReference(
        gap.contentVersionId,
        ["evidenceGaps", index, "contentVersionId"],
        "Evidence gap"
      );
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

    fixture.organizations.forEach((organization, index) => {
      checkSourceReferences(organization.sourceIds, ["organizations", index, "sourceIds"], "Organization");
      checkDatasetReference(organization.datasetVersionId, ["organizations", index, "datasetVersionId"], "Organization");
      if (organization.headquartersEntityId && !entityIds.has(organization.headquartersEntityId)) {
        context.addIssue({ code: "custom", path: ["organizations", index, "headquartersEntityId"], message: "Organization references an unknown headquarters entity" });
      }
    });

    fixture.facilities.forEach((facility, index) => {
      if (!organizationIds.has(facility.organizationId)) context.addIssue({ code: "custom", path: ["facilities", index, "organizationId"], message: "Facility references an unknown organization" });
      if (!entityIds.has(facility.entityId)) context.addIssue({ code: "custom", path: ["facilities", index, "entityId"], message: "Facility references an unknown entity" });
      checkSourceReferences(facility.sourceIds, ["facilities", index, "sourceIds"], "Facility");
      checkEvidenceReferences(facility.evidenceIds, facility.sourceIds, ["facilities", index, "evidenceIds"], "Facility");
      checkDatasetReference(facility.datasetVersionId, ["facilities", index, "datasetVersionId"], "Facility");
      checkContentVersionReference(facility.contentVersionId, ["facilities", index, "contentVersionId"], "Facility");
    });

    fixture.manufacturingProcessChains.forEach((chain, index) => {
      if (!itemIds.has(chain.itemId)) context.addIssue({ code: "custom", path: ["manufacturingProcessChains", index, "itemId"], message: "Manufacturing process chain references an unknown item" });
      checkSourceReferences(chain.sourceIds, ["manufacturingProcessChains", index, "sourceIds"], "Manufacturing process chain");
      checkEvidenceReferences(chain.evidenceIds, chain.sourceIds, ["manufacturingProcessChains", index, "evidenceIds"], "Manufacturing process chain");
      checkDatasetReference(chain.datasetVersionId, ["manufacturingProcessChains", index, "datasetVersionId"], "Manufacturing process chain");
      checkContentVersionReference(chain.contentVersionId, ["manufacturingProcessChains", index, "contentVersionId"], "Manufacturing process chain");
    });

    fixture.manufacturingRouteVariants.forEach((variant, index) => {
      if (!processChainIds.has(variant.processChainId)) context.addIssue({ code: "custom", path: ["manufacturingRouteVariants", index, "processChainId"], message: "Manufacturing route variant references an unknown chain" });
      variant.stepIds.forEach((stepId) => { if (!processStepIds.has(stepId)) context.addIssue({ code: "custom", path: ["manufacturingRouteVariants", index, "stepIds"], message: `Manufacturing route variant references unknown step ${stepId}` }); });
      checkSourceReferences(variant.sourceIds, ["manufacturingRouteVariants", index, "sourceIds"], "Manufacturing route variant");
      checkEvidenceReferences(variant.evidenceIds, variant.sourceIds, ["manufacturingRouteVariants", index, "evidenceIds"], "Manufacturing route variant");
      checkDatasetReference(variant.datasetVersionId, ["manufacturingRouteVariants", index, "datasetVersionId"], "Manufacturing route variant");
      checkContentVersionReference(variant.contentVersionId, ["manufacturingRouteVariants", index, "contentVersionId"], "Manufacturing route variant");
    });

    fixture.manufacturingProcessSteps.forEach((step, index) => {
      if (!processChainIds.has(step.processChainId)) context.addIssue({ code: "custom", path: ["manufacturingProcessSteps", index, "processChainId"], message: "Manufacturing process step references an unknown chain" });
      [...step.inputItemIds, ...step.outputItemIds].forEach((itemId) => { if (!itemIds.has(itemId)) context.addIssue({ code: "custom", path: ["manufacturingProcessSteps", index], message: `Manufacturing process step references unknown item ${itemId}` }); });
      step.routeVariantIds.forEach((variantId) => { if (!processRouteVariantIds.has(variantId)) context.addIssue({ code: "custom", path: ["manufacturingProcessSteps", index, "routeVariantIds"], message: `Manufacturing process step references unknown route variant ${variantId}` }); });
      checkSourceReferences(step.sourceIds, ["manufacturingProcessSteps", index, "sourceIds"], "Manufacturing process step");
      checkEvidenceReferences(step.evidenceIds, step.sourceIds, ["manufacturingProcessSteps", index, "evidenceIds"], "Manufacturing process step");
      checkDatasetReference(step.datasetVersionId, ["manufacturingProcessSteps", index, "datasetVersionId"], "Manufacturing process step");
      checkContentVersionReference(step.contentVersionId, ["manufacturingProcessSteps", index, "contentVersionId"], "Manufacturing process step");
    });

    fixture.equipmentCategories.forEach((equipment, index) => {
      checkSourceReferences(equipment.sourceIds, ["equipmentCategories", index, "sourceIds"], "Equipment category");
      checkDatasetReference(equipment.datasetVersionId, ["equipmentCategories", index, "datasetVersionId"], "Equipment category");
    });

    fixture.processRequirements.forEach((requirement, index) => {
      if (!processStepIds.has(requirement.processStepId)) context.addIssue({ code: "custom", path: ["processRequirements", index, "processStepId"], message: "Process requirement references an unknown process step" });
      if (requirement.equipmentCategoryId && !equipmentCategoryIds.has(requirement.equipmentCategoryId)) context.addIssue({ code: "custom", path: ["processRequirements", index, "equipmentCategoryId"], message: "Process requirement references an unknown equipment category" });
      if (requirement.itemId && !itemIds.has(requirement.itemId)) context.addIssue({ code: "custom", path: ["processRequirements", index, "itemId"], message: "Process requirement references an unknown item" });
      checkSourceReferences(requirement.sourceIds, ["processRequirements", index, "sourceIds"], "Process requirement");
      checkEvidenceReferences(requirement.evidenceIds, requirement.sourceIds, ["processRequirements", index, "evidenceIds"], "Process requirement");
      checkDatasetReference(requirement.datasetVersionId, ["processRequirements", index, "datasetVersionId"], "Process requirement");
      checkContentVersionReference(requirement.contentVersionId, ["processRequirements", index, "contentVersionId"], "Process requirement");
    });

    fixture.organizationCapabilities.forEach((capability, index) => {
      if (!organizationIds.has(capability.organizationId)) context.addIssue({ code: "custom", path: ["organizationCapabilities", index, "organizationId"], message: "Organization capability references an unknown organization" });
      if (!equipmentCategoryIds.has(capability.equipmentCategoryId)) context.addIssue({ code: "custom", path: ["organizationCapabilities", index, "equipmentCategoryId"], message: "Organization capability references an unknown equipment category" });
      if (capability.customerOrganizationId && !organizationIds.has(capability.customerOrganizationId)) context.addIssue({ code: "custom", path: ["organizationCapabilities", index, "customerOrganizationId"], message: "Organization capability references an unknown customer organization" });
      checkSourceReferences(capability.sourceIds, ["organizationCapabilities", index, "sourceIds"], "Organization capability");
      checkEvidenceReferences(capability.evidenceIds, capability.sourceIds, ["organizationCapabilities", index, "evidenceIds"], "Organization capability");
      checkDatasetReference(capability.datasetVersionId, ["organizationCapabilities", index, "datasetVersionId"], "Organization capability");
      checkContentVersionReference(capability.contentVersionId, ["organizationCapabilities", index, "contentVersionId"], "Organization capability");
      const supportTypes = capability.evidenceIds.map((id) => evidenceById.get(id)?.supportType);
      if (capability.capabilityEvidenceLevel === "manufacturer_supported" && !supportTypes.includes("manufacturer_capability")) context.addIssue({ code: "custom", path: ["organizationCapabilities", index, "capabilityEvidenceLevel"], message: "Manufacturer-supported capability requires manufacturer_capability evidence" });
      if (capability.capabilityEvidenceLevel === "commercial_relationship_supported" && !supportTypes.includes("commercial_relationship")) context.addIssue({ code: "custom", path: ["organizationCapabilities", index, "capabilityEvidenceLevel"], message: "Commercial relationship capability requires commercial_relationship evidence" });
    });

    const procedureStepIds = new Set(fixture.tradeProcedureSteps.map((step) => step.id));
    fixture.tradeGuides.forEach((guide, index) => {
      if (!entityIds.has(guide.scope.jurisdictionEntityId)) context.addIssue({ code: "custom", path: ["tradeGuides", index, "scope", "jurisdictionEntityId"], message: "Trade guide references an unknown jurisdiction" });
      if (guide.scope.itemId && !itemIds.has(guide.scope.itemId)) context.addIssue({ code: "custom", path: ["tradeGuides", index, "scope", "itemId"], message: "Trade guide references an unknown item" });
      checkSourceReferences(guide.sourceIds, ["tradeGuides", index, "sourceIds"], "Trade guide");
      checkEvidenceReferences(guide.evidenceIds, guide.sourceIds, ["tradeGuides", index, "evidenceIds"], "Trade guide");
      checkDatasetReference(guide.datasetVersionId, ["tradeGuides", index, "datasetVersionId"], "Trade guide");
      checkContentVersionReference(guide.contentVersionId, ["tradeGuides", index, "contentVersionId"], "Trade guide");
    });
    fixture.tariffMeasures.forEach((measure, index) => {
      if (!tradeGuideIds.has(measure.guideId)) context.addIssue({ code: "custom", path: ["tariffMeasures", index, "guideId"], message: "Tariff measure references an unknown trade guide" });
      checkSourceReferences(measure.sourceIds, ["tariffMeasures", index, "sourceIds"], "Tariff measure");
      checkEvidenceReferences(measure.evidenceIds, measure.sourceIds, ["tariffMeasures", index, "evidenceIds"], "Tariff measure");
      checkDatasetReference(measure.datasetVersionId, ["tariffMeasures", index, "datasetVersionId"], "Tariff measure");
      checkContentVersionReference(measure.contentVersionId, ["tariffMeasures", index, "contentVersionId"], "Tariff measure");
    });
    fixture.tradeRequirements.forEach((requirement, index) => {
      if (!tradeGuideIds.has(requirement.guideId)) context.addIssue({ code: "custom", path: ["tradeRequirements", index, "guideId"], message: "Trade requirement references an unknown trade guide" });
      requirement.documentRequirementIds.forEach((id) => { if (!tradeDocumentIds.has(id)) context.addIssue({ code: "custom", path: ["tradeRequirements", index, "documentRequirementIds"], message: `Trade requirement references unknown document ${id}` }); });
      if (requirement.procedureId && !tradeProcedureIds.has(requirement.procedureId)) context.addIssue({ code: "custom", path: ["tradeRequirements", index, "procedureId"], message: "Trade requirement references an unknown procedure" });
      checkSourceReferences(requirement.sourceIds, ["tradeRequirements", index, "sourceIds"], "Trade requirement");
      checkEvidenceReferences(requirement.evidenceIds, requirement.sourceIds, ["tradeRequirements", index, "evidenceIds"], "Trade requirement");
      checkDatasetReference(requirement.datasetVersionId, ["tradeRequirements", index, "datasetVersionId"], "Trade requirement");
      checkContentVersionReference(requirement.contentVersionId, ["tradeRequirements", index, "contentVersionId"], "Trade requirement");
    });
    fixture.tradeProcedures.forEach((procedure, index) => {
      if (!tradeGuideIds.has(procedure.guideId)) context.addIssue({ code: "custom", path: ["tradeProcedures", index, "guideId"], message: "Trade procedure references an unknown trade guide" });
      procedure.stepIds.forEach((id) => { if (!procedureStepIds.has(id)) context.addIssue({ code: "custom", path: ["tradeProcedures", index, "stepIds"], message: `Trade procedure references unknown step ${id}` }); });
      checkSourceReferences(procedure.sourceIds, ["tradeProcedures", index, "sourceIds"], "Trade procedure");
      checkEvidenceReferences(procedure.evidenceIds, procedure.sourceIds, ["tradeProcedures", index, "evidenceIds"], "Trade procedure");
      checkDatasetReference(procedure.datasetVersionId, ["tradeProcedures", index, "datasetVersionId"], "Trade procedure");
      checkContentVersionReference(procedure.contentVersionId, ["tradeProcedures", index, "contentVersionId"], "Trade procedure");
    });
    fixture.tradeProcedureSteps.forEach((step, index) => {
      if (!tradeProcedureIds.has(step.procedureId)) context.addIssue({ code: "custom", path: ["tradeProcedureSteps", index, "procedureId"], message: "Trade procedure step references an unknown procedure" });
      step.documentRequirementIds.forEach((id) => { if (!tradeDocumentIds.has(id)) context.addIssue({ code: "custom", path: ["tradeProcedureSteps", index, "documentRequirementIds"], message: `Trade procedure step references unknown document ${id}` }); });
      checkSourceReferences(step.sourceIds, ["tradeProcedureSteps", index, "sourceIds"], "Trade procedure step");
      checkEvidenceReferences(step.evidenceIds, step.sourceIds, ["tradeProcedureSteps", index, "evidenceIds"], "Trade procedure step");
      checkDatasetReference(step.datasetVersionId, ["tradeProcedureSteps", index, "datasetVersionId"], "Trade procedure step");
      checkContentVersionReference(step.contentVersionId, ["tradeProcedureSteps", index, "contentVersionId"], "Trade procedure step");
    });
    fixture.tradeDocumentRequirements.forEach((document, index) => {
      if (!tradeGuideIds.has(document.guideId)) context.addIssue({ code: "custom", path: ["tradeDocumentRequirements", index, "guideId"], message: "Trade document requirement references an unknown trade guide" });
      checkSourceReferences(document.sourceIds, ["tradeDocumentRequirements", index, "sourceIds"], "Trade document requirement");
      checkEvidenceReferences(document.evidenceIds, document.sourceIds, ["tradeDocumentRequirements", index, "evidenceIds"], "Trade document requirement");
      checkDatasetReference(document.datasetVersionId, ["tradeDocumentRequirements", index, "datasetVersionId"], "Trade document requirement");
      checkContentVersionReference(document.contentVersionId, ["tradeDocumentRequirements", index, "contentVersionId"], "Trade document requirement");
    });
    fixture.policyDocuments.forEach((document, index) => {
      if (!entityIds.has(document.jurisdictionEntityId)) context.addIssue({ code: "custom", path: ["policyDocuments", index, "jurisdictionEntityId"], message: "Policy document references an unknown jurisdiction" });
      if (!sourceIdSet.has(document.sourceId)) context.addIssue({ code: "custom", path: ["policyDocuments", index, "sourceId"], message: "Policy document references an unknown source" });
      checkSourceReferences(document.sourceIds, ["policyDocuments", index, "sourceIds"], "Policy document");
      checkEvidenceReferences(document.evidenceIds, document.sourceIds, ["policyDocuments", index, "evidenceIds"], "Policy document");
      checkDatasetReference(document.datasetVersionId, ["policyDocuments", index, "datasetVersionId"], "Policy document");
      checkContentVersionReference(document.contentVersionId, ["policyDocuments", index, "contentVersionId"], "Policy document");
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
