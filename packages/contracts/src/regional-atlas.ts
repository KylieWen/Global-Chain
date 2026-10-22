import { z } from "zod";
import { IdSchema, NonEmptyStringSchema, PeriodSchema } from "./primitives";

const provenance = {
  period: z.union([PeriodSchema,z.object({granularity:z.literal("snapshot"),start:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),end:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),label:NonEmptyStringSchema}).refine(period=>period.start<=period.end,"Invalid snapshot period")]),
  unit: z.literal("not_applicable"),
  method: z.literal("curated"),
  datasetVersion: NonEmptyStringSchema,
  dataStatus: z.literal("observed"),
  sourceIds: z.array(IdSchema).min(1)
};

/** Regional roles are an independently versioned layer, never bilateral trade facts. */
export const RegionalAtlasSchema = z.object({
  schemaVersion: z.literal("regional-supply-atlas.v1"),
  datasetVersion: NonEmptyStringSchema,
  reviewedAt: z.string().datetime(),
  regionEntityId: IdSchema,
  sources: z.array(z.object({
    id: IdSchema, name: NonEmptyStringSchema, publisher: NonEmptyStringSchema,
    url: z.string().url(), retrievedAt: z.string().datetime(),
    rawPath: NonEmptyStringSchema, sha256: z.string().regex(/^[a-f0-9]{64}$/),
    scope: NonEmptyStringSchema
  })).min(1),
  places: z.array(z.object({
    id: IdSchema, name: NonEmptyStringSchema, provinceCode: NonEmptyStringSchema,
    coordinates: z.tuple([z.number().min(73).max(136), z.number().min(3).max(54)]),
    coordinateMethod: z.literal("approximate_city_anchor"),
    coordinateSourceId: IdSchema
  })),
  nodes: z.array(z.object({
    id: IdSchema, productId: IdSchema, placeId: IdSchema,
    stage: z.enum(["material", "component", "manufacturing", "market"]),
    label: NonEmptyStringSchema, description: NonEmptyStringSchema,
    organizationIds: z.array(IdSchema), topicIds: z.array(IdSchema), ...provenance
  })),
  connections: z.array(z.object({
    id: IdSchema, from: IdSchema, to: IdSchema,
    label: NonEmptyStringSchema, description: NonEmptyStringSchema,
    evidenceLevel: z.literal("representative"),
    value: z.null(), valueDataStatus: z.literal("unknown"), ...provenance
  }))
}).superRefine((atlas, ctx) => {
  const sourceIds = new Set(atlas.sources.map(source => source.id));
  const places = new Set(atlas.places.map(place => place.id));
  const nodes = new Map(atlas.nodes.map(node => [node.id, node]));
  for (const records of [atlas.sources, atlas.places, atlas.nodes, atlas.connections]) {
    if (new Set(records.map(record => record.id)).size !== records.length) ctx.addIssue({code:"custom", message:"Duplicate regional atlas ID"});
  }
  for (const place of atlas.places) if (!sourceIds.has(place.coordinateSourceId)) ctx.addIssue({code:"custom", message:`Unknown coordinate source: ${place.id}`});
  for (const record of [...atlas.nodes, ...atlas.connections]) {
    if (record.datasetVersion !== atlas.datasetVersion || record.sourceIds.some(id => !sourceIds.has(id))) ctx.addIssue({code:"custom", message:`Invalid atlas provenance: ${record.id}`});
  }
  for (const node of atlas.nodes) if (!places.has(node.placeId)) ctx.addIssue({code:"custom", message:`Unknown atlas place: ${node.id}`});
  for (const edge of atlas.connections) {
    const a = nodes.get(edge.from); const b = nodes.get(edge.to);
    if (!a || !b || a.id === b.id || a.productId !== b.productId) ctx.addIssue({code:"custom", message:`Invalid regional connection: ${edge.id}`});
  }
});

export type RegionalAtlas = z.infer<typeof RegionalAtlasSchema>;
