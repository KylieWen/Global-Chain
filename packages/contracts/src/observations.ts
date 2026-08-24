import { z } from "zod";
import {
  CurrencySchema,
  DataMethodSchema,
  DirectionSchema,
  FactStatusSchema,
  FlowKindSchema,
  FiniteNumberSchema,
  IdSchema,
  NonEmptyStringSchema,
  NonNegativeNumberSchema,
  NullableIdSchema,
  NullableStringSchema,
  PeriodSchema,
  SourceIdsSchema,
  StatisticalConceptSchema,
  RelationTypeSchema,
  UnitSchema,
  validateFactMetadata,
  validateMeasuredValue
} from "./primitives";

export const SupplyFlowSchema = z
  .object({
    id: IdSchema,
    fromEntityId: IdSchema,
    toEntityId: IdSchema,
    itemId: IdSchema,
    processStageId: IdSchema,
    relationType: RelationTypeSchema,
    flowKind: FlowKindSchema,
    period: PeriodSchema,
    value: NonNegativeNumberSchema.nullable().optional(),
    quantity: NonNegativeNumberSchema.nullable().optional(),
    currency: CurrencySchema.nullable().optional(),
    unit: UnitSchema.nullable().optional(),
    method: DataMethodSchema,
    sourceIds: SourceIdsSchema,
    confidence: FiniteNumberSchema.min(0).max(1).nullable().optional(),
    dataStatus: FactStatusSchema,
    datasetVersionId: NullableIdSchema,
    notes: NullableStringSchema
  })
  .superRefine((flow, context) => {
    validateFactMetadata(flow, context);
    validateMeasuredValue(flow, context);
  });
export type SupplyFlow = z.infer<typeof SupplyFlowSchema>;

export const TradeObservationSchema = z
  .object({
    id: IdSchema,
    reporterEntityId: IdSchema,
    partnerEntityId: NullableIdSchema,
    direction: DirectionSchema,
    classificationSystem: NonEmptyStringSchema,
    classificationVersion: NonEmptyStringSchema,
    classificationCode: NonEmptyStringSchema,
    itemId: NullableIdSchema,
    period: PeriodSchema,
    value: NonNegativeNumberSchema.nullable().optional(),
    quantity: NonNegativeNumberSchema.nullable().optional(),
    currency: CurrencySchema.nullable().optional(),
    unit: UnitSchema.nullable().optional(),
    statisticalConcept: StatisticalConceptSchema,
    sourceId: NullableIdSchema,
    datasetVersionId: NullableIdSchema,
    method: DataMethodSchema,
    dataStatus: FactStatusSchema,
    qualityNote: NullableStringSchema
  })
  .superRefine((observation, context) => {
    if (observation.method !== "mock" && !observation.sourceId) {
      context.addIssue({
        code: "custom",
        path: ["sourceId"],
        message: "Non-mock trade observations must reference a source"
      });
    }
    if (observation.method !== "mock" && !observation.datasetVersionId) {
      context.addIssue({
        code: "custom",
        path: ["datasetVersionId"],
        message: "Non-mock trade observations must reference a dataset version"
      });
    }
    validateMeasuredValue(observation, context);
  });
export type TradeObservation = z.infer<typeof TradeObservationSchema>;

export const MacroIndicatorObservationSchema = z
  .object({
    id: IdSchema,
    entityId: IdSchema,
    indicator: NonEmptyStringSchema,
    period: PeriodSchema,
    value: FiniteNumberSchema.nullable().optional(),
    quantity: NonNegativeNumberSchema.nullable().optional(),
    currency: CurrencySchema.nullable().optional(),
    unit: UnitSchema.nullable().optional(),
    sourceId: NullableIdSchema,
    datasetVersionId: NullableIdSchema,
    method: DataMethodSchema,
    dataStatus: FactStatusSchema,
    notes: NullableStringSchema
  })
  .superRefine((observation, context) => {
    if (observation.method !== "mock" && !observation.sourceId) {
      context.addIssue({
        code: "custom",
        path: ["sourceId"],
        message: "Non-mock macro observations must reference a source"
      });
    }
    if (observation.method !== "mock" && !observation.datasetVersionId) {
      context.addIssue({
        code: "custom",
        path: ["datasetVersionId"],
        message: "Non-mock macro observations must reference a dataset version"
      });
    }
    validateMeasuredValue(observation, context);
  });
export type MacroIndicatorObservation = z.infer<typeof MacroIndicatorObservationSchema>;

export const ValueTypeSchema = z.enum([
  "customs_trade_value",
  "gross_output",
  "domestic_value_added",
  "labor_income",
  "taxes",
  "operating_surplus",
  "profit_estimate",
  "consumer_price"
]);
export type ValueType = z.infer<typeof ValueTypeSchema>;

export const ValueObservationSchema = z
  .object({
    id: IdSchema,
    entityId: IdSchema,
    itemId: NullableIdSchema,
    valueType: ValueTypeSchema,
    period: PeriodSchema,
    value: FiniteNumberSchema.nullable().optional(),
    lowerBound: FiniteNumberSchema.nullable().optional(),
    upperBound: FiniteNumberSchema.nullable().optional(),
    currency: CurrencySchema.nullable().optional(),
    unit: UnitSchema.nullable().optional(),
    method: DataMethodSchema,
    sourceIds: SourceIdsSchema,
    dataStatus: FactStatusSchema,
    datasetVersionId: NullableIdSchema,
    assumptions: z.array(NonEmptyStringSchema),
    notes: NullableStringSchema
  })
  .superRefine((observation, context) => {
    validateFactMetadata(observation, context);
    if (observation.value !== undefined && observation.value !== null && !observation.currency) {
      context.addIssue({
        code: "custom",
        path: ["currency"],
        message: "currency is required when value is provided"
      });
    }
    if (
      observation.lowerBound !== undefined &&
      observation.lowerBound !== null &&
      observation.upperBound !== undefined &&
      observation.upperBound !== null &&
      observation.lowerBound > observation.upperBound
    ) {
      context.addIssue({
        code: "custom",
        path: ["upperBound"],
        message: "upperBound must not be lower than lowerBound"
      });
    }
  });
export type ValueObservation = z.infer<typeof ValueObservationSchema>;
