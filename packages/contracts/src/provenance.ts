import { z } from "zod";
import {
  ClassificationMappingTypeSchema,
  ContentStatusSchema,
  DataMethodSchema,
  DirectionSchema,
  IdSchema,
  NonEmptyStringSchema,
  NullableIdSchema,
  PeriodSchema,
  PublicationStatusSchema,
  SourceIdsSchema,
  SupplyChainEvidenceLevelSchema
} from "./primitives";

export const SourceSchema = z.object({
  id: IdSchema,
  name: NonEmptyStringSchema,
  publisher: NonEmptyStringSchema,
  url: z.string().url().nullable().optional(),
  license: z.string().trim().min(1).nullable().optional(),
  publishedAt: z.string().trim().min(1).nullable().optional(),
  retrievedAt: z.string().trim().min(1).nullable().optional(),
  datasetVersion: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional()
});
export type Source = z.infer<typeof SourceSchema>;

export const EvidenceSupportTypeSchema = z.enum([
  "country_role",
  "bilateral_flow",
  "process_context",
  "trade_observation",
  "classification",
  "curation_method",
  "manufacturer_capability",
  "commercial_relationship"
]);
export type EvidenceSupportType = z.infer<typeof EvidenceSupportTypeSchema>;

export const EvidenceScopeSchema = z
  .object({
    entityIds: z.array(IdSchema).default([]),
    fromEntityId: NullableIdSchema.default(null),
    toEntityId: NullableIdSchema.default(null),
    itemIds: z.array(IdSchema).default([]),
    processStageIds: z.array(IdSchema).default([]),
    processStepIds: z.array(IdSchema).default([]),
    equipmentCategoryIds: z.array(IdSchema).default([]),
    organizationIds: z.array(IdSchema).default([]),
    classificationCodes: z
      .array(
        z.object({
          system: NonEmptyStringSchema,
          version: NonEmptyStringSchema,
          code: NonEmptyStringSchema,
          mappingType: ClassificationMappingTypeSchema,
          description: NonEmptyStringSchema
        })
      )
      .default([]),
    direction: DirectionSchema.nullable().default(null),
    period: PeriodSchema.nullable().default(null),
    scopeDescription: NonEmptyStringSchema,
    supportsCountryRole: z.boolean(),
    supportsBilateralFlow: z.boolean(),
    supportsProcessContext: z.boolean(),
    supportsManufacturerCapability: z.boolean().default(false),
    supportsCommercialRelationship: z.boolean().default(false),
    limitations: z.array(NonEmptyStringSchema).min(1)
  })
  .superRefine((scope, context) => {
    const hasFrom = Boolean(scope.fromEntityId);
    const hasTo = Boolean(scope.toEntityId);
    if (hasFrom !== hasTo) {
      context.addIssue({
        code: "custom",
        path: [hasFrom ? "toEntityId" : "fromEntityId"],
        message: "Evidence scope must provide both bilateral endpoints or neither"
      });
    }
    if (
      scope.supportsBilateralFlow &&
      (!scope.fromEntityId ||
        !scope.toEntityId ||
        !scope.direction ||
        !scope.period ||
        (scope.itemIds.length === 0 && scope.classificationCodes.length === 0))
    ) {
      context.addIssue({
        code: "custom",
        path: ["supportsBilateralFlow"],
        message:
          "Bilateral evidence scope requires both endpoints, direction, period and an item or classification code"
      });
    }
    if (
      scope.supportsCountryRole &&
      ((scope.entityIds.length === 0 && !scope.fromEntityId && !scope.toEntityId) || !scope.period)
    ) {
      context.addIssue({
        code: "custom",
        path: ["supportsCountryRole"],
        message: "Country-role evidence scope requires at least one entity endpoint and a period"
      });
    }
  });
export type EvidenceScope = z.infer<typeof EvidenceScopeSchema>;

export const EvidenceSchema = z
  .object({
    id: IdSchema,
    sourceId: IdSchema,
    supportType: EvidenceSupportTypeSchema.default("process_context"),
    scope: EvidenceScopeSchema.nullable().default(null),
    locator: NonEmptyStringSchema,
    excerpt: z.string().trim().min(1).nullable().optional(),
    notes: z.string().trim().min(1).nullable().optional()
  })
  .superRefine((evidence, context) => {
    if (!evidence.scope) return;
    if (evidence.supportType === "country_role" && !evidence.scope.supportsCountryRole) {
      context.addIssue({
        code: "custom",
        path: ["scope", "supportsCountryRole"],
        message: "country_role evidence must explicitly support a country role"
      });
    }
    if (evidence.supportType === "bilateral_flow" && !evidence.scope.supportsBilateralFlow) {
      context.addIssue({
        code: "custom",
        path: ["scope", "supportsBilateralFlow"],
        message: "bilateral_flow evidence must explicitly support a bilateral flow"
      });
    }
    if (evidence.supportType === "process_context" && !evidence.scope.supportsProcessContext) {
      context.addIssue({
        code: "custom",
        path: ["scope", "supportsProcessContext"],
        message: "process_context evidence must explicitly support process context"
      });
    }
    if (evidence.supportType === "manufacturer_capability" && !evidence.scope.supportsManufacturerCapability) {
      context.addIssue({ code: "custom", path: ["scope", "supportsManufacturerCapability"], message: "manufacturer_capability evidence must explicitly support a manufacturer capability" });
    }
    if (evidence.supportType === "commercial_relationship" && !evidence.scope.supportsCommercialRelationship) {
      context.addIssue({ code: "custom", path: ["scope", "supportsCommercialRelationship"], message: "commercial_relationship evidence must explicitly support a commercial relationship" });
    }
  });
export type Evidence = z.infer<typeof EvidenceSchema>;

export const EvidenceGapStatusSchema = z.enum([
  "open",
  "partial",
  "closed",
  "not_publicly_observable"
]);
export type EvidenceGapStatus = z.infer<typeof EvidenceGapStatusSchema>;

export const EvidenceCandidateSourceSchema = z.object({
  name: NonEmptyStringSchema,
  publisher: NonEmptyStringSchema,
  url: z.string().url().nullable().default(null),
  license: NonEmptyStringSchema,
  notes: NonEmptyStringSchema
});
export type EvidenceCandidateSource = z.infer<typeof EvidenceCandidateSourceSchema>;

export const EvidenceClassificationCandidateSchema = z.object({
  system: NonEmptyStringSchema,
  version: NonEmptyStringSchema,
  code: NonEmptyStringSchema,
  label: NonEmptyStringSchema,
  mappingType: ClassificationMappingTypeSchema,
  limitation: NonEmptyStringSchema,
  /** An HS product definition may be exact while its final use remains unobservable. */
  supportsEndUse: z.boolean().default(false)
});
export type EvidenceClassificationCandidate = z.infer<
  typeof EvidenceClassificationCandidateSchema
>;

export const EvidenceGapSchema = z
  .object({
    gapId: IdSchema,
    nodeId: NullableIdSchema.default(null),
    flowId: NullableIdSchema.default(null),
    currentClaim: NonEmptyStringSchema,
    currentEvidenceLevel: SupplyChainEvidenceLevelSchema,
    missingEvidence: NonEmptyStringSchema,
    acceptableEvidenceTypes: z.array(EvidenceSupportTypeSchema).min(1),
    candidateSources: z.array(EvidenceCandidateSourceSchema).min(1),
    classificationCandidates: z.array(EvidenceClassificationCandidateSchema).default([]),
    status: EvidenceGapStatusSchema,
    nonInferences: z.array(NonEmptyStringSchema).min(1),
    evidenceIds: z.array(IdSchema).default([]),
    period: PeriodSchema,
    method: DataMethodSchema,
    datasetVersionId: IdSchema,
    contentVersionId: IdSchema
  })
  .superRefine((gap, context) => {
    if (Boolean(gap.nodeId) === Boolean(gap.flowId)) {
      context.addIssue({
        code: "custom",
        path: ["nodeId"],
        message: "Evidence gap must target exactly one node or flow"
      });
    }
    if (gap.status === "closed" && gap.evidenceIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["evidenceIds"],
        message: "Closed evidence gaps must reference closing evidence"
      });
    }
    if (gap.status === "partial" && gap.evidenceIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["evidenceIds"],
        message: "Partial evidence gaps must reference the available partial evidence"
      });
    }
    if (
      gap.classificationCandidates.some(
        (candidate) => candidate.supportsEndUse && candidate.mappingType !== "exact"
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["classificationCandidates"],
        message: "Only an exact classification candidate may claim end-use support"
      });
    }
  });
export type EvidenceGap = z.infer<typeof EvidenceGapSchema>;

export const DatasetVersionSchema = z.object({
  id: IdSchema,
  name: NonEmptyStringSchema,
  version: NonEmptyStringSchema,
  publishedAt: z.string().trim().min(1).nullable().optional(),
  sourceIds: SourceIdsSchema,
  coverage: z.number().finite().min(0).max(1).nullable().optional(),
  status: PublicationStatusSchema,
  notes: z.string().trim().min(1).nullable().optional()
});
export type DatasetVersion = z.infer<typeof DatasetVersionSchema>;

export const ContentVersionSchema = z.object({
  id: IdSchema,
  version: NonEmptyStringSchema,
  status: PublicationStatusSchema,
  publishedAt: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional()
});
export type ContentVersion = z.infer<typeof ContentVersionSchema>;

export const ContentReferenceSchema = z.object({
  contentStatus: ContentStatusSchema,
  contentVersionId: IdSchema.nullable().optional()
});
export type ContentReference = z.infer<typeof ContentReferenceSchema>;
