import { z } from "zod";
import {
  ContentStatusSchema,
  DataMethodSchema,
  EvidenceIdsSchema,
  FactStatusSchema,
  IdSchema,
  ItemTypeSchema,
  NonEmptyStringSchema,
  NullableIdSchema,
  NullableStringSchema,
  PeriodSchema,
  SourceIdsSchema,
  SupplyChainEvidenceLevelSchema,
  validateFactMetadata
} from "./primitives";
import { SupplyFlowSchema } from "./observations";

export const StoryNodeTypeSchema = z.enum(["entity", "item", "process", "market"]);
export type StoryNodeType = z.infer<typeof StoryNodeTypeSchema>;

export const StoryNodeSchema = z
  .object({
    id: IdSchema,
    nodeType: StoryNodeTypeSchema,
    label: NonEmptyStringSchema,
    entityId: NullableIdSchema,
    itemId: NullableIdSchema,
    itemType: ItemTypeSchema.nullable().optional(),
    processStageId: NullableIdSchema,
    period: PeriodSchema.nullable().optional().default(null),
    sourceIds: SourceIdsSchema,
    evidenceIds: EvidenceIdsSchema.default([]),
    evidenceLevel: SupplyChainEvidenceLevelSchema.default("none"),
    method: DataMethodSchema,
    dataStatus: FactStatusSchema,
    datasetVersionId: NullableIdSchema,
    contentVersionId: NullableIdSchema.default(null),
    notes: NullableStringSchema
  })
  .superRefine((node, context) => {
    validateFactMetadata(node, context);

    if (!node.entityId && !node.itemId && !node.processStageId) {
      context.addIssue({
        code: "custom",
        path: ["entityId"],
        message: "A story node must reference an entity, item, or process stage"
      });
    }
  });
export type StoryNode = z.infer<typeof StoryNodeSchema>;

export const StoryStepSchema = z.object({
  id: IdSchema,
  order: z.number().int().nonnegative(),
  title: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  nodeIds: z.array(IdSchema),
  flowIds: z.array(IdSchema),
  evidenceIds: EvidenceIdsSchema,
  method: DataMethodSchema.default("mock"),
  contentStatus: ContentStatusSchema,
  contentVersionId: NullableIdSchema
});
export type StoryStep = z.infer<typeof StoryStepSchema>;

export const StoryGraphSchema = z
  .object({
    productId: IdSchema,
    period: PeriodSchema,
    method: DataMethodSchema.default("mock"),
    representativeStatement: NullableStringSchema.default(null),
    methodology: z.array(NonEmptyStringSchema).default([]),
    limitations: z.array(NonEmptyStringSchema).default([]),
    nodes: z.array(StoryNodeSchema),
    flows: z.array(SupplyFlowSchema),
    steps: z.array(StoryStepSchema),
    datasetVersionId: NullableIdSchema,
    contentVersionId: NullableIdSchema,
    warnings: z.array(NonEmptyStringSchema)
  })
  .superRefine((graph, context) => {
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    const nodeEntityIds = new Set(
      graph.nodes.flatMap((node) => (node.entityId ? [node.entityId] : []))
    );
    const flowIds = new Set(graph.flows.map((flow) => flow.id));

    if (new Set(graph.nodes.map((node) => node.id)).size !== graph.nodes.length) {
      context.addIssue({ code: "custom", path: ["nodes"], message: "Story node IDs must be unique" });
    }
    if (new Set(graph.flows.map((flow) => flow.id)).size !== graph.flows.length) {
      context.addIssue({ code: "custom", path: ["flows"], message: "Story flow IDs must be unique" });
    }
    if (new Set(graph.steps.map((step) => step.id)).size !== graph.steps.length) {
      context.addIssue({ code: "custom", path: ["steps"], message: "Story step IDs must be unique" });
    }

    graph.flows.forEach((flow, index) => {
      if (!nodeIds.has(flow.fromEntityId) && !nodeEntityIds.has(flow.fromEntityId)) {
        context.addIssue({
          code: "custom",
          path: ["flows", index, "fromEntityId"],
          message: "Flow source must reference a story node"
        });
      }
      if (!nodeIds.has(flow.toEntityId) && !nodeEntityIds.has(flow.toEntityId)) {
        context.addIssue({
          code: "custom",
          path: ["flows", index, "toEntityId"],
          message: "Flow destination must reference a story node"
        });
      }
    });

    graph.steps.forEach((step, index) => {
      step.nodeIds.forEach((nodeId, nodeIndex) => {
        if (!nodeIds.has(nodeId)) {
          context.addIssue({
            code: "custom",
            path: ["steps", index, "nodeIds", nodeIndex],
            message: "Story step references an unknown node"
          });
        }
      });
      step.flowIds.forEach((flowId, flowIndex) => {
        if (!flowIds.has(flowId)) {
          context.addIssue({
            code: "custom",
            path: ["steps", index, "flowIds", flowIndex],
            message: "Story step references an unknown flow"
          });
        }
      });
    });
  });
export type StoryGraph = z.infer<typeof StoryGraphSchema>;
