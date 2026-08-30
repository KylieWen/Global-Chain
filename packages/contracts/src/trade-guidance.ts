import { z } from "zod";
import {
  ClassificationMappingTypeSchema,
  DataMethodSchema,
  DirectionSchema,
  EvidenceIdsSchema,
  FactStatusSchema,
  IdSchema,
  NonEmptyStringSchema,
  NullableIdSchema,
  NullableStringSchema,
  PeriodSchema,
  SourceIdsSchema,
  validateFactMetadata
} from "./primitives";

export const PolicyCoverageStatusSchema = z.enum(["available", "partial", "not_available", "not_publicly_observable"]);
export type PolicyCoverageStatus = z.infer<typeof PolicyCoverageStatusSchema>;
export const PolicyApplicabilitySchema = z.enum(["required", "conditional", "recommended", "prohibited", "not_applicable", "unknown"]);
export type PolicyApplicability = z.infer<typeof PolicyApplicabilitySchema>;
export const PolicyLifecycleStatusSchema = z.enum(["active", "scheduled", "expired", "superseded", "withdrawn", "unknown"]);
export type PolicyLifecycleStatus = z.infer<typeof PolicyLifecycleStatusSchema>;
export const PolicyEvidenceLevelSchema = z.enum(["official_legal", "official_guidance", "international", "secondary", "curated", "none"]);
export type PolicyEvidenceLevel = z.infer<typeof PolicyEvidenceLevelSchema>;
export const TradeGuideReviewStatusSchema = z.enum(["draft", "validated", "published", "deprecated"]);

export const TradePolicyScopeSchema = z.object({
  jurisdictionEntityId: IdSchema,
  direction: DirectionSchema,
  itemId: NullableIdSchema.default(null),
  classification: z.object({
    system: NonEmptyStringSchema,
    version: NonEmptyStringSchema,
    code: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    mappingType: ClassificationMappingTypeSchema
  }).nullable().default(null),
  originScope: z.enum(["all_origins", "specific_origin", "preferential_agreement", "unknown"]),
  originEntityId: NullableIdSchema.default(null),
  destinationEntityId: NullableIdSchema.default(null),
  regime: z.enum(["standard", "preferential", "transit", "temporary", "other"]),
  period: PeriodSchema
}).superRefine((scope, context) => {
  if (scope.originScope === "specific_origin" && !scope.originEntityId) {
    context.addIssue({ code: "custom", path: ["originEntityId"], message: "specific_origin requires originEntityId" });
  }
  if (scope.originScope !== "specific_origin" && scope.originEntityId) {
    context.addIssue({ code: "custom", path: ["originEntityId"], message: "originEntityId is only valid for specific_origin" });
  }
  if (scope.regime === "preferential" && scope.originScope !== "preferential_agreement") {
    context.addIssue({ code: "custom", path: ["originScope"], message: "preferential regime requires preferential_agreement origin scope" });
  }
});
export type TradePolicyScope = z.infer<typeof TradePolicyScopeSchema>;

const GuidanceMetadata = {
  period: PeriodSchema,
  method: DataMethodSchema,
  sourceIds: SourceIdsSchema,
  evidenceIds: EvidenceIdsSchema.default([]),
  dataStatus: FactStatusSchema,
  datasetVersionId: NullableIdSchema,
  contentVersionId: NullableIdSchema.default(null),
  limitations: z.array(NonEmptyStringSchema).min(1)
};

export const TradeGuideSchema = z.object({
  id: IdSchema,
  scope: TradePolicyScopeSchema,
  title: NonEmptyStringSchema,
  summary: NonEmptyStringSchema,
  coverageStatus: PolicyCoverageStatusSchema,
  reviewStatus: TradeGuideReviewStatusSchema,
  lastReviewedAt: NonEmptyStringSchema,
  nextReviewAt: NullableStringSchema.default(null),
  disclaimer: NonEmptyStringSchema,
  ...GuidanceMetadata
}).superRefine(validateFactMetadata);
export type TradeGuide = z.infer<typeof TradeGuideSchema>;

export const TariffMeasureSchema = z.object({
  id: IdSchema,
  guideId: IdSchema,
  measureType: z.enum(["customs_duty", "preferential_duty", "vat", "excise", "anti_dumping", "safeguard", "export_tax", "quota", "other"]),
  rateType: z.enum(["ad_valorem", "specific", "compound", "free", "prohibited", "quota", "unknown"]),
  rateValue: z.number().finite().nonnegative().nullable(),
  rateCurrency: NullableStringSchema.default(null),
  rateUnit: NullableStringSchema.default(null),
  calculationBasis: z.enum(["customs_value", "cif", "fob", "weight", "quantity", "other", "unknown"]),
  formula: NullableStringSchema.default(null),
  applicability: PolicyApplicabilitySchema,
  lifecycleStatus: PolicyLifecycleStatusSchema,
  ...GuidanceMetadata
}).superRefine((measure, context) => {
  validateFactMetadata(measure, context);
  if (["unknown", "withheld"].includes(measure.dataStatus) && measure.rateValue !== null) {
    context.addIssue({ code: "custom", path: ["rateValue"], message: "Unknown/withheld tariff values must be null" });
  }
  if (measure.rateType === "specific" && !measure.rateUnit && measure.rateValue !== null) {
    context.addIssue({ code: "custom", path: ["rateUnit"], message: "Specific tariffs require a rate unit" });
  }
});
export type TariffMeasure = z.infer<typeof TariffMeasureSchema>;

export const TradeRequirementSchema = z.object({
  id: IdSchema,
  guideId: IdSchema,
  requirementType: z.enum(["import_license", "export_license", "customs_declaration", "registration", "conformity", "labeling", "origin_proof", "inspection", "sanction", "prohibited", "restricted", "quota", "tax_registration", "other"]),
  title: NonEmptyStringSchema,
  summary: NonEmptyStringSchema,
  applicability: PolicyApplicabilitySchema,
  conditions: z.array(NonEmptyStringSchema).default([]),
  authority: NullableStringSchema.default(null),
  legalBasis: NullableStringSchema.default(null),
  documentRequirementIds: z.array(IdSchema).default([]),
  procedureId: NullableIdSchema.default(null),
  evidenceLevel: PolicyEvidenceLevelSchema,
  ...GuidanceMetadata
}).superRefine(validateFactMetadata);
export type TradeRequirement = z.infer<typeof TradeRequirementSchema>;

export const TradeProcedureSchema = z.object({
  id: IdSchema,
  guideId: IdSchema,
  title: NonEmptyStringSchema,
  purpose: NonEmptyStringSchema,
  authority: NullableStringSchema.default(null),
  officialUrl: z.string().url().nullable().default(null),
  stepIds: z.array(IdSchema).default([]),
  processingTime: z.object({ value: z.number().finite().nonnegative().nullable(), unit: NullableStringSchema.default(null), dataStatus: FactStatusSchema }),
  ...GuidanceMetadata
}).superRefine(validateFactMetadata);
export type TradeProcedure = z.infer<typeof TradeProcedureSchema>;

export const TradeProcedureStepSchema = z.object({
  id: IdSchema,
  procedureId: IdSchema,
  order: z.number().int().nonnegative(),
  action: NonEmptyStringSchema,
  actorType: z.enum(["trader", "customs_broker", "authority", "carrier", "other"]),
  mandatoryStatus: PolicyApplicabilitySchema,
  documentRequirementIds: z.array(IdSchema).default([]),
  channel: z.enum(["online", "office", "port", "unknown"]),
  notes: NullableStringSchema.default(null),
  ...GuidanceMetadata
}).superRefine(validateFactMetadata);
export type TradeProcedureStep = z.infer<typeof TradeProcedureStepSchema>;

export const TradeDocumentRequirementSchema = z.object({
  id: IdSchema,
  guideId: IdSchema,
  documentType: NonEmptyStringSchema,
  label: NonEmptyStringSchema,
  mandatoryStatus: PolicyApplicabilitySchema,
  issuer: NullableStringSchema.default(null),
  purpose: NonEmptyStringSchema,
  format: NullableStringSchema.default(null),
  conditions: z.array(NonEmptyStringSchema).default([]),
  ...GuidanceMetadata
}).superRefine(validateFactMetadata);
export type TradeDocumentRequirement = z.infer<typeof TradeDocumentRequirementSchema>;

export const PolicyDocumentSchema = z.object({
  id: IdSchema,
  jurisdictionEntityId: IdSchema,
  documentType: z.enum(["law", "regulation", "tariff_schedule", "customs_guide", "official_notice", "portal"]),
  title: NonEmptyStringSchema,
  issuingAuthority: NullableStringSchema.default(null),
  identifier: NullableStringSchema.default(null),
  sourceId: IdSchema,
  language: NullableStringSchema.default(null),
  effectiveFrom: NullableStringSchema.default(null),
  effectiveTo: NullableStringSchema.default(null),
  retrievedAt: NonEmptyStringSchema,
  redistributionRestriction: NullableStringSchema.default(null),
  ...GuidanceMetadata
}).superRefine(validateFactMetadata);
export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>;
