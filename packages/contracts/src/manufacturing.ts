import { z } from "zod";
import {
  DataMethodSchema,
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

export const OrganizationKindSchema = z.enum([
  "manufacturer",
  "supplier",
  "service_provider",
  "research_institution",
  "other"
]);

export const OrganizationSchema = z.object({
  id: IdSchema,
  name: NonEmptyStringSchema,
  organizationKind: OrganizationKindSchema,
  headquartersEntityId: NullableIdSchema.default(null),
  website: z.string().url().nullable().default(null),
  description: NullableStringSchema,
  sourceIds: SourceIdsSchema,
  period: PeriodSchema,
  method: DataMethodSchema,
  dataStatus: FactStatusSchema,
  datasetVersionId: NullableIdSchema
}).superRefine(validateFactMetadata);
export type Organization = z.infer<typeof OrganizationSchema>;

export const FacilitySchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  entityId: IdSchema,
  name: NonEmptyStringSchema,
  facilityType: z.enum(["manufacturing", "research", "headquarters", "sales", "other"]),
  description: NullableStringSchema,
  sourceIds: SourceIdsSchema,
  evidenceIds: EvidenceIdsSchema.default([]),
  period: PeriodSchema,
  method: DataMethodSchema,
  dataStatus: FactStatusSchema,
  datasetVersionId: NullableIdSchema,
  contentVersionId: NullableIdSchema.default(null)
}).superRefine(validateFactMetadata);
export type Facility = z.infer<typeof FacilitySchema>;

export const ManufacturingProcessChainSchema = z.object({
  id: IdSchema,
  itemId: IdSchema,
  title: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  period: PeriodSchema,
  sourceIds: SourceIdsSchema,
  evidenceIds: EvidenceIdsSchema.default([]),
  method: DataMethodSchema,
  dataStatus: FactStatusSchema,
  datasetVersionId: NullableIdSchema,
  contentVersionId: NullableIdSchema.default(null),
  limitations: z.array(NonEmptyStringSchema).min(1)
}).superRefine(validateFactMetadata);
export type ManufacturingProcessChain = z.infer<typeof ManufacturingProcessChainSchema>;

export const ManufacturingRouteVariantSchema = z.object({
  id: IdSchema,
  processChainId: IdSchema,
  name: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  stepIds: z.array(IdSchema).min(1),
  applicability: NonEmptyStringSchema,
  period: PeriodSchema,
  sourceIds: SourceIdsSchema,
  evidenceIds: EvidenceIdsSchema.default([]),
  method: DataMethodSchema,
  dataStatus: FactStatusSchema,
  datasetVersionId: NullableIdSchema,
  contentVersionId: NullableIdSchema.default(null),
  limitations: z.array(NonEmptyStringSchema).min(1)
}).superRefine(validateFactMetadata);
export type ManufacturingRouteVariant = z.infer<typeof ManufacturingRouteVariantSchema>;

export const ManufacturingProcessStepSchema = z.object({
  id: IdSchema,
  processChainId: IdSchema,
  order: z.number().int().nonnegative(),
  name: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  phase: NonEmptyStringSchema.default("未分组"),
  routeVariantIds: z.array(IdSchema).default([]),
  inputItemIds: z.array(IdSchema).default([]),
  outputItemIds: z.array(IdSchema).default([]),
  period: PeriodSchema,
  sourceIds: SourceIdsSchema,
  evidenceIds: EvidenceIdsSchema.default([]),
  method: DataMethodSchema,
  dataStatus: FactStatusSchema,
  datasetVersionId: NullableIdSchema,
  contentVersionId: NullableIdSchema.default(null),
  limitations: z.array(NonEmptyStringSchema).default([])
}).superRefine(validateFactMetadata);
export type ManufacturingProcessStep = z.infer<typeof ManufacturingProcessStepSchema>;

export const EquipmentCategorySchema = z.object({
  id: IdSchema,
  name: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  sourceIds: SourceIdsSchema,
  period: PeriodSchema,
  method: DataMethodSchema,
  dataStatus: FactStatusSchema,
  datasetVersionId: NullableIdSchema
}).superRefine(validateFactMetadata);
export type EquipmentCategory = z.infer<typeof EquipmentCategorySchema>;

export const ProcessRequirementSchema = z.object({
  id: IdSchema,
  processStepId: IdSchema,
  requirementType: z.enum(["equipment", "material", "consumable", "software", "service"]),
  equipmentCategoryId: NullableIdSchema.default(null),
  itemId: NullableIdSchema.default(null),
  name: NonEmptyStringSchema,
  necessity: z.enum(["core", "supporting", "optional"]),
  description: NonEmptyStringSchema,
  period: PeriodSchema,
  sourceIds: SourceIdsSchema,
  evidenceIds: EvidenceIdsSchema.default([]),
  method: DataMethodSchema,
  dataStatus: FactStatusSchema,
  datasetVersionId: NullableIdSchema,
  contentVersionId: NullableIdSchema.default(null),
  limitations: z.array(NonEmptyStringSchema).default([])
}).superRefine((requirement, context) => {
  validateFactMetadata(requirement, context);
  if (requirement.requirementType === "equipment" && !requirement.equipmentCategoryId) {
    context.addIssue({ code: "custom", path: ["equipmentCategoryId"], message: "Equipment requirements must reference an equipment category" });
  }
  if (requirement.requirementType !== "equipment" && !requirement.itemId) {
    context.addIssue({ code: "custom", path: ["itemId"], message: "Non-equipment requirements must reference an item" });
  }
});
export type ProcessRequirement = z.infer<typeof ProcessRequirementSchema>;

export const CapabilityEvidenceLevelSchema = z.enum([
  "manufacturer_supported",
  "commercial_relationship_supported",
  "representative",
  "none"
]);
export type CapabilityEvidenceLevel = z.infer<typeof CapabilityEvidenceLevelSchema>;

export const OrganizationCapabilitySchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  equipmentCategoryId: IdSchema,
  capabilityEvidenceLevel: CapabilityEvidenceLevelSchema,
  claim: NonEmptyStringSchema,
  commercialRelationshipClaimed: z.boolean().default(false),
  customerOrganizationId: NullableIdSchema.default(null),
  period: PeriodSchema,
  sourceIds: SourceIdsSchema,
  evidenceIds: EvidenceIdsSchema.default([]),
  method: DataMethodSchema,
  dataStatus: FactStatusSchema,
  datasetVersionId: NullableIdSchema,
  contentVersionId: NullableIdSchema.default(null),
  limitations: z.array(NonEmptyStringSchema).min(1)
}).superRefine((capability, context) => {
  validateFactMetadata(capability, context);
  if (capability.commercialRelationshipClaimed !== Boolean(capability.customerOrganizationId)) {
    context.addIssue({ code: "custom", path: ["customerOrganizationId"], message: "A commercial relationship claim requires an explicit customer, and vice versa" });
  }
  if (capability.capabilityEvidenceLevel === "commercial_relationship_supported" && !capability.commercialRelationshipClaimed) {
    context.addIssue({ code: "custom", path: ["commercialRelationshipClaimed"], message: "Commercial relationship evidence level requires an explicit relationship claim" });
  }
});
export type OrganizationCapability = z.infer<typeof OrganizationCapabilitySchema>;
