import { z } from "zod";
import {
  CurrencySchema,
  DataMethodSchema,
  DirectionSchema,
  EvidenceIdsSchema,
  FactStatusSchema,
  FlowKindSchema,
  FiniteNumberSchema,
  IdSchema,
  NonEmptyStringSchema,
  NonNegativeNumberSchema,
  NullableIdSchema,
  NullableStringSchema,
  PeriodSchema,
  PartnerScopeSchema,
  SourceIdsSchema,
  StatisticalConceptSchema,
  SupplyChainEvidenceLevelSchema,
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
    evidenceIds: EvidenceIdsSchema.default([]),
    evidenceLevel: SupplyChainEvidenceLevelSchema.default("none"),
    confidence: FiniteNumberSchema.min(0).max(1).nullable().optional(),
    dataStatus: FactStatusSchema,
    valueDataStatus: FactStatusSchema.optional(),
    quantityDataStatus: FactStatusSchema.optional(),
    datasetVersionId: NullableIdSchema,
    contentVersionId: NullableIdSchema.default(null),
    notes: NullableStringSchema
  })
  .superRefine((flow, context) => {
    validateFactMetadata(flow, context);
    validateMeasuredValue(flow, context);

    const valueDataStatus =
      flow.valueDataStatus ??
      (flow.value === null || flow.value === undefined ? "unknown" : flow.dataStatus);
    const quantityDataStatus =
      flow.quantityDataStatus ??
      (flow.quantity === null || flow.quantity === undefined ? "unknown" : flow.dataStatus);

    if (
      (valueDataStatus === "unknown" || valueDataStatus === "withheld") &&
      flow.value !== null &&
      flow.value !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: `${valueDataStatus} supply-flow values must be null`
      });
    }
    if (
      valueDataStatus === "observed" &&
      (flow.value === null || flow.value === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Observed supply-flow values must provide a numeric value"
      });
    }
    if (
      (quantityDataStatus === "unknown" || quantityDataStatus === "withheld") &&
      flow.quantity !== null &&
      flow.quantity !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["quantity"],
        message: `${quantityDataStatus} supply-flow quantities must be null`
      });
    }
    if (
      quantityDataStatus === "observed" &&
      (flow.quantity === null || flow.quantity === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Observed supply-flow quantities must provide a numeric quantity"
      });
    }
  })
  .transform((flow) => ({
    ...flow,
    valueDataStatus:
      flow.valueDataStatus ??
      (flow.value === null || flow.value === undefined ? "unknown" : flow.dataStatus),
    quantityDataStatus:
      flow.quantityDataStatus ??
      (flow.quantity === null || flow.quantity === undefined ? "unknown" : flow.dataStatus)
  }));
export type SupplyFlow = z.infer<typeof SupplyFlowSchema>;

export const TradeObservationSchema = z
  .object({
    id: IdSchema,
    reporterEntityId: IdSchema,
    /** Source-native reporter code; may differ from the local geographic code. */
    reporterCode: z.number().int().nonnegative().nullable().optional(),
    partnerEntityId: NullableIdSchema,
    /** Source-native partner code when one is available (0 means world total in Comtrade). */
    partnerCode: z.number().int().nonnegative().nullable().optional(),
    /** Source-native second-partner code (0 commonly means not applicable/world). */
    partner2Code: z.number().int().nonnegative().nullable().optional(),
    /** Source-native flow code (M import / X export) when available. */
    flowCode: z.enum(["M", "X"]).nullable().optional(),
    /** Structured scope prevents a null partner entity from being guessed as a world total. */
    partnerScope: PartnerScopeSchema.nullable().optional(),
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
    /** Monetary value status; defaults to dataStatus for older fixtures. */
    valueDataStatus: FactStatusSchema.optional(),
    /** Quantity status is independent from monetary and weight estimation flags. */
    quantityDataStatus: FactStatusSchema.optional(),
    /** Quality flags retained independently from value and quantity status. */
    quality: z
      .object({
        legacyEstimationFlag: z.number().int().nullable().optional(),
        isQtyEstimated: z.boolean().nullable().optional(),
        isNetWgtEstimated: z.boolean().nullable().optional(),
        isReported: z.boolean().nullable().optional(),
        isAggregate: z.boolean().nullable().optional(),
        sourceDatasetCode: z.union([z.string(), z.number()]).nullable().optional(),
        sourcePublicationDate: z.string().nullable().optional(),
        sourceRevision: z.string().nullable().optional()
      })
      .nullable()
      .optional(),
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
    if (observation.partnerScope === "entity" && !observation.partnerEntityId) {
      context.addIssue({
        code: "custom",
        path: ["partnerEntityId"],
        message: "Entity partner scope requires partnerEntityId"
      });
    }
    if (
      observation.partnerEntityId &&
      observation.partnerScope &&
      observation.partnerScope !== "entity"
    ) {
      context.addIssue({
        code: "custom",
        path: ["partnerScope"],
        message: "A specific partner entity requires entity partner scope"
      });
    }
    if (observation.valueDataStatus && observation.valueDataStatus !== observation.dataStatus) {
      context.addIssue({
        code: "custom",
        path: ["valueDataStatus"],
        message: "Trade observation dataStatus must match valueDataStatus"
      });
    }
    const valueStatus = observation.valueDataStatus ?? observation.dataStatus;
    const quantityStatus = observation.quantityDataStatus ??
      (observation.quantity === null || observation.quantity === undefined
        ? "unknown"
        : observation.dataStatus);
    if (
      (valueStatus === "unknown" || valueStatus === "withheld") &&
      observation.value !== null &&
      observation.value !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: `${valueStatus} monetary values must be null`
      });
    }
    if (
      valueStatus === "observed" &&
      (observation.value === null || observation.value === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Observed monetary values must provide a numeric value"
      });
    }
    if (
      (quantityStatus === "unknown" || quantityStatus === "withheld") &&
      observation.quantity !== null &&
      observation.quantity !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["quantity"],
        message: `${quantityStatus} quantities must be null`
      });
    }
    if (
      quantityStatus === "observed" &&
      (observation.quantity === null || observation.quantity === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Observed quantities must provide a numeric quantity"
      });
    }
    validateMeasuredValue(observation, context);
  });
export type TradeObservation = z.infer<typeof TradeObservationSchema>;

/** Material customs observation kept separate from finished-product trade. */
export const MaterialTradeObservationSchema = z.object({
  observationId: IdSchema,
  materialItemId: IdSchema,
  reporterEntityId: IdSchema,
  partnerEntityId: NullableIdSchema,
  reporterCode: z.number().int().nonnegative(),
  partnerCode: z.number().int().nonnegative(),
  partnerScope: PartnerScopeSchema,
  flow: DirectionSchema,
  classificationSystem: NonEmptyStringSchema,
  classificationVersion: NonEmptyStringSchema,
  classificationCode: NonEmptyStringSchema,
  classificationMappingType: z.enum(["exact", "aggregate", "approximate", "curated"]),
  period: PeriodSchema,
  currency: CurrencySchema.nullable(),
  value: NonNegativeNumberSchema.nullable(),
  quantity: NonNegativeNumberSchema.nullable(),
  valueDataStatus: FactStatusSchema,
  quantityDataStatus: FactStatusSchema,
  quality: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  sourceId: IdSchema,
  datasetVersionId: IdSchema,
  method: DataMethodSchema,
  evidenceLevel: SupplyChainEvidenceLevelSchema,
  limitation: NonEmptyStringSchema
}).superRefine((observation, context) => {
  if (observation.partnerCode === 0) {
    if (observation.partnerScope !== "world_total" || observation.partnerEntityId !== null) {
      context.addIssue({ code: "custom", path: ["partnerScope"], message: "partnerCode=0 requires world_total and null partner" });
    }
  } else if (observation.partnerScope !== "entity" || !observation.partnerEntityId) {
    context.addIssue({ code: "custom", path: ["partnerScope"], message: "Specific material partners require entity scope and partner entity" });
  }
  if ((observation.valueDataStatus === "unknown" || observation.valueDataStatus === "withheld") && observation.value !== null) {
    context.addIssue({ code: "custom", path: ["value"], message: "Unknown/withheld values must be null" });
  }
  if ((observation.quantityDataStatus === "unknown" || observation.quantityDataStatus === "withheld") && observation.quantity !== null) {
    context.addIssue({ code: "custom", path: ["quantity"], message: "Unknown/withheld quantities must be null" });
  }
});
export type MaterialTradeObservation = z.infer<typeof MaterialTradeObservationSchema>;

/**
 * Display and interpretation metadata for an open-ended macro indicator key.
 * Definitions are optional at the fixture boundary so older draft fixtures keep
 * loading, while published datasets can provide a complete, data-driven label
 * and provenance description.
 */
export const IndicatorDefinitionSchema = z
  .object({
    id: IdSchema,
    indicator: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    shortLabel: NullableStringSchema,
    description: NullableStringSchema,
    category: NullableStringSchema,
    displayOrder: z.number().int().nonnegative().nullable().optional(),
    displayUnit: NullableStringSchema,
    displayCurrency: CurrencySchema.nullable().optional(),
    valueMeaning: NullableStringSchema,
    sourceIndicatorCode: NullableStringSchema,
    statisticalConcept: StatisticalConceptSchema.nullable().optional(),
    formula: NullableStringSchema,
    period: PeriodSchema.nullable().optional(),
    sourceIds: SourceIdsSchema,
    method: DataMethodSchema,
    dataStatus: FactStatusSchema,
    datasetVersionId: NullableIdSchema
  })
  .superRefine(validateFactMetadata);
export type IndicatorDefinition = z.infer<typeof IndicatorDefinitionSchema>;

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
    statisticalConcept: StatisticalConceptSchema.nullable().optional(),
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
    if (
      (observation.dataStatus === "unknown" || observation.dataStatus === "withheld") &&
      observation.value !== null &&
      observation.value !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: `${observation.dataStatus} macro values must be null`
      });
    }
    if (
      observation.dataStatus === "observed" &&
      (observation.value === null || observation.value === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Observed macro values must provide a numeric value"
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
