import { z } from "zod";
import {
  ClassificationMappingTypeSchema,
  DataMethodSchema,
  EvidenceIdsSchema,
  FactStatusSchema,
  GeoEntityKindSchema,
  IdSchema,
  Iso2Schema,
  Iso3Schema,
  M49Schema,
  ItemTypeSchema,
  NullableIdSchema,
  NullableStringSchema,
  NonEmptyStringSchema,
  PeriodSchema,
  SourceIdsSchema,
  SupplyChainEvidenceLevelSchema,
  validateFactMetadata
} from "./primitives";

export const GeoEntitySchema = z.object({
  id: IdSchema,
  kind: GeoEntityKindSchema,
  name: NonEmptyStringSchema,
  iso2: Iso2Schema.nullable().optional(),
  iso3: Iso3Schema.nullable().optional(),
  m49: M49Schema.nullable().optional(),
  parentId: NullableIdSchema,
  sourceIds: SourceIdsSchema,
  dataStatus: FactStatusSchema,
  method: DataMethodSchema,
  datasetVersionId: NullableIdSchema,
  validPeriod: PeriodSchema.nullable().optional()
});
export type GeoEntity = z.infer<typeof GeoEntitySchema>;

export const ItemSchema = z.object({
  id: IdSchema,
  slug: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  itemType: ItemTypeSchema,
  parentItemId: NullableIdSchema,
  category: NonEmptyStringSchema,
  description: NullableStringSchema,
  sourceIds: SourceIdsSchema,
  dataStatus: FactStatusSchema,
  method: DataMethodSchema,
  datasetVersionId: NullableIdSchema,
  validPeriod: PeriodSchema.nullable().optional()
});
export type Item = z.infer<typeof ItemSchema>;

export const ProcessStageSchema = z.object({
  id: IdSchema,
  code: NonEmptyStringSchema,
  label: NonEmptyStringSchema,
  order: z.number().int().nonnegative(),
  description: NullableStringSchema,
  sourceIds: SourceIdsSchema,
  dataStatus: FactStatusSchema,
  method: DataMethodSchema,
  datasetVersionId: NullableIdSchema
});
export type ProcessStage = z.infer<typeof ProcessStageSchema>;

export const ProductionActivitySchema = z
  .object({
    id: IdSchema,
    locationEntityId: IdSchema,
    processStageId: IdSchema,
    inputItemIds: z.array(IdSchema),
    outputItemIds: z.array(IdSchema),
    period: PeriodSchema,
    sourceIds: SourceIdsSchema,
    evidenceIds: EvidenceIdsSchema.default([]),
    evidenceLevel: SupplyChainEvidenceLevelSchema.default("none"),
    method: DataMethodSchema,
    dataStatus: FactStatusSchema,
    datasetVersionId: NullableIdSchema,
    contentVersionId: NullableIdSchema.default(null),
    notes: NullableStringSchema
  })
  .superRefine(validateFactMetadata);
export type ProductionActivity = z.infer<typeof ProductionActivitySchema>;

export const ClassificationCodeSchema = z.object({
  id: IdSchema,
  system: NonEmptyStringSchema,
  version: NonEmptyStringSchema,
  code: NonEmptyStringSchema,
  level: z.number().int().nonnegative(),
  label: NonEmptyStringSchema,
  validPeriod: PeriodSchema.nullable().optional(),
  sourceIds: SourceIdsSchema,
  dataStatus: FactStatusSchema,
  method: DataMethodSchema,
  datasetVersionId: NullableIdSchema
});
export type ClassificationCode = z.infer<typeof ClassificationCodeSchema>;

export const ClassificationCrosswalkSchema = z
  .object({
    id: IdSchema,
    itemId: IdSchema,
    classificationCodeId: IdSchema,
    mappingType: ClassificationMappingTypeSchema,
    confidence: z.number().finite().min(0).max(1).nullable().optional(),
    notes: NullableStringSchema,
    period: PeriodSchema,
    sourceIds: SourceIdsSchema,
    method: DataMethodSchema,
    dataStatus: FactStatusSchema,
    datasetVersionId: NullableIdSchema
  })
  .superRefine(validateFactMetadata);
export type ClassificationCrosswalk = z.infer<typeof ClassificationCrosswalkSchema>;
