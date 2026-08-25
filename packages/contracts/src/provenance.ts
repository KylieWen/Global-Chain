import { z } from "zod";
import {
  ContentStatusSchema,
  IdSchema,
  NonEmptyStringSchema,
  PublicationStatusSchema,
  SourceIdsSchema
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
  "curation_method"
]);
export type EvidenceSupportType = z.infer<typeof EvidenceSupportTypeSchema>;

export const EvidenceSchema = z.object({
  id: IdSchema,
  sourceId: IdSchema,
  supportType: EvidenceSupportTypeSchema.default("process_context"),
  locator: NonEmptyStringSchema,
  excerpt: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional()
});
export type Evidence = z.infer<typeof EvidenceSchema>;

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
