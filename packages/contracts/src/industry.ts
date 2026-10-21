import { z } from "zod";
import { IdSchema, NonEmptyStringSchema, PeriodSchema, SourceIdsSchema } from "./primitives";

const fact = {
  period: PeriodSchema,
  unit: z.literal("not_applicable"),
  sourceIds: SourceIdsSchema.refine(ids => ids.length > 0, "Industry records require sources"),
  datasetVersionId: IdSchema,
  method: z.literal("curated"),
  dataStatus: z.literal("observed")
};
const officialLink = z.object({
  label: NonEmptyStringSchema,
  kind: z.enum(["product", "contact", "sales", "support"]),
  url: z.string().url().refine(url => /^https?:\/\//.test(url), "Only public HTTP links are supported")
});
export const IndustryTopicSchema = z.object({
  id: IdSchema, label: NonEmptyStringSchema,
  kind: z.enum(["material", "component", "equipment", "product", "channel", "service"]),
  description: NonEmptyStringSchema, ...fact
});
export const IndustryRelationSchema = z.object({
  id: IdSchema, fromTopicId: IdSchema, toTopicId: IdSchema,
  kind: z.enum(["process_input", "equipment_for", "used_in", "sold_through"]),
  description: NonEmptyStringSchema, ...fact
});
export const IndustryParticipantSchema = z.object({
  id: IdSchema, name: NonEmptyStringSchema, description: NonEmptyStringSchema,
  topicIds: z.array(IdSchema).min(1), links: z.array(officialLink).min(1), ...fact
});
export const IndustryNetworkSchema = z.object({
  schemaVersion: z.literal("industry-network.v1"), id: IdSchema,
  title: NonEmptyStringSchema, regionEntityId: IdSchema, defaultTopicId: IdSchema,
  topics: z.array(IndustryTopicSchema).min(1),
  relations: z.array(IndustryRelationSchema), organizations: z.array(IndustryParticipantSchema),
  ...fact
}).superRefine((network, context) => {
  const topics = new Set(network.topics.map(topic => topic.id));
  if (topics.size !== network.topics.length) context.addIssue({code:"custom",message:"Duplicate industry topic"});
  if (!topics.has(network.defaultTopicId)) context.addIssue({code:"custom",message:"Unknown default industry topic"});
  for (const relation of network.relations) {
    if (!topics.has(relation.fromTopicId) || !topics.has(relation.toTopicId) || relation.fromTopicId === relation.toTopicId) context.addIssue({code:"custom",message:`Invalid industry connection ${relation.id}`});
  }
  for (const organization of network.organizations) {
    if (organization.topicIds.some(id => !topics.has(id))) context.addIssue({code:"custom",message:`Unknown topic for ${organization.name}`});
  }
  for (const records of [network.relations, network.organizations]) {
    if (new Set(records.map(record => record.id)).size !== records.length) context.addIssue({code:"custom",message:"Duplicate industry record"});
  }
});
export type IndustryNetwork = z.infer<typeof IndustryNetworkSchema>;
