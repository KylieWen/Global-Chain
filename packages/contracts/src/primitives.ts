import { z } from "zod";

export const IdSchema = z.string().trim().min(1);
export const NullableIdSchema = IdSchema.nullable().optional();
export const NonEmptyStringSchema = z.string().trim().min(1);
export const NullableStringSchema = NonEmptyStringSchema.nullable().optional();

export const Iso2Schema = z.string().regex(/^[A-Z]{2}$/, "Expected an ISO 3166-1 alpha-2 code");
export const Iso3Schema = z.string().regex(/^[A-Z]{3}$/, "Expected an ISO 3166-1 alpha-3 code");
export const M49Schema = z.string().regex(/^\d{3}$/, "Expected a UN M49 numeric code");

export const PeriodGranularitySchema = z.enum(["annual", "quarterly", "monthly"]);
export type PeriodGranularity = z.infer<typeof PeriodGranularitySchema>;

const CalendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const PeriodSchema = z
  .object({
    granularity: PeriodGranularitySchema,
    start: CalendarDateSchema,
    end: CalendarDateSchema,
    label: NonEmptyStringSchema
  })
  .superRefine((period, context) => {
    if (period.start > period.end) {
      context.addIssue({
        code: "custom",
        path: ["end"],
        message: "Period end must not precede period start"
      });
    }
  });
export type Period = z.infer<typeof PeriodSchema>;

export const DataMethodSchema = z.enum([
  "mock",
  "official",
  "curated",
  "derived",
  "estimated",
  "inference",
  "scenario"
]);
export type DataMethod = z.infer<typeof DataMethodSchema>;

export const FactStatusSchema = z.enum(["observed", "estimated", "unknown", "withheld", "invalid"]);
export type FactStatus = z.infer<typeof FactStatusSchema>;

export const PublicationStatusSchema = z.enum(["draft", "validated", "published", "deprecated"]);
export type PublicationStatus = z.infer<typeof PublicationStatusSchema>;

export const ContentStatusSchema = z.enum(["draft", "published"]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const ConfidenceSchema = z.number().finite().min(0).max(1);
export const FiniteNumberSchema = z.number().finite();
export const NonNegativeNumberSchema = FiniteNumberSchema.nonnegative();
export const CurrencySchema = NonEmptyStringSchema;
export const UnitSchema = NonEmptyStringSchema;

export const SourceIdsSchema = z.array(IdSchema).refine((ids) => new Set(ids).size === ids.length, {
  message: "sourceIds must not contain duplicates"
});

export const FlowKindSchema = z.enum([
  "representative_supply",
  "curated_physical",
  "statistical_trade",
  "derived",
  "scenario"
]);
export type FlowKind = z.infer<typeof FlowKindSchema>;

export const RelationTypeSchema = z.enum([
  "input",
  "output",
  "production",
  "trade",
  "transport",
  "assembly",
  "consumption",
  "dependency",
  "conversion"
]);
export type RelationType = z.infer<typeof RelationTypeSchema>;

export const ItemTypeSchema = z.enum([
  "final_product",
  "component",
  "material",
  "raw_material",
  "equipment",
  "service"
]);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const GeoEntityKindSchema = z.enum(["country", "region", "port", "facility"]);
export type GeoEntityKind = z.infer<typeof GeoEntityKindSchema>;

export const DirectionSchema = z.enum(["import", "export"]);
export type Direction = z.infer<typeof DirectionSchema>;

/** Scope of a trade observation's partner dimension. */
export const PartnerScopeSchema = z.enum([
  "world_total",
  "entity",
  "unspecified",
  "not_applicable"
]);
export type PartnerScope = z.infer<typeof PartnerScopeSchema>;

export const StatisticalConceptSchema = z.enum([
  "customs",
  "balance_of_payments",
  "official_reserve",
  "national_accounts",
  "other"
]);
export type StatisticalConcept = z.infer<typeof StatisticalConceptSchema>;

export const ClassificationMappingTypeSchema = z.enum(["exact", "aggregate", "approximate", "curated"]);
export type ClassificationMappingType = z.infer<typeof ClassificationMappingTypeSchema>;

export interface FactMetadataInput {
  method: DataMethod;
  sourceIds: string[];
  datasetVersionId?: string | null;
}

export function validateFactMetadata(value: FactMetadataInput, context: z.RefinementCtx): void {
  if (value.method !== "mock" && value.sourceIds.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["sourceIds"],
      message: "Non-mock facts must reference at least one source"
    });
  }

  if (value.method !== "mock" && !value.datasetVersionId) {
    context.addIssue({
      code: "custom",
      path: ["datasetVersionId"],
      message: "Non-mock facts must reference a dataset version"
    });
  }
}

export interface MeasuredValueInput {
  value?: number | null;
  quantity?: number | null;
  currency?: string | null;
  unit?: string | null;
}

export function validateMeasuredValue(value: MeasuredValueInput, context: z.RefinementCtx): void {
  if (value.value !== undefined && value.value !== null && !value.currency) {
    context.addIssue({
      code: "custom",
      path: ["currency"],
      message: "currency is required when value is provided"
    });
  }

  if (value.quantity !== undefined && value.quantity !== null && !value.unit) {
    context.addIssue({
      code: "custom",
      path: ["unit"],
      message: "unit is required when quantity is provided"
    });
  }
}
