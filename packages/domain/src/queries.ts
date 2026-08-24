import type {
  ClassificationCode,
  DatasetVersion,
  Evidence,
  FactStatus,
  GeoEntity,
  IndicatorDefinition,
  Item,
  MacroIndicatorObservation,
  Period,
  ProductionActivity,
  ProcessStage,
  Source,
  StoryNode,
  StoryStep,
  SupplyFlow,
  TradeObservation
} from "@globe-chain/contracts";
import type {
  DeepReadonly,
  FixtureRepository,
  ReadonlyProductFixture
} from "./repository";

type ReadonlyItem = DeepReadonly<Item>;
type ReadonlyGeoEntity = DeepReadonly<GeoEntity>;
type ReadonlyDatasetVersion = DeepReadonly<DatasetVersion>;
type ReadonlyEvidence = DeepReadonly<Evidence>;
type ReadonlyPeriod = DeepReadonly<Period>;
type ReadonlyProductionActivity = DeepReadonly<ProductionActivity>;
type ReadonlyProcessStage = DeepReadonly<ProcessStage>;
type ReadonlySource = DeepReadonly<Source>;
type ReadonlyStoryNode = DeepReadonly<StoryNode>;
type ReadonlyStoryStep = DeepReadonly<StoryStep>;
type ReadonlySupplyFlow = DeepReadonly<SupplyFlow>;
type ReadonlyTradeObservation = DeepReadonly<TradeObservation>;
type ReadonlyMacroIndicatorObservation = DeepReadonly<MacroIndicatorObservation>;
type ReadonlyIndicatorDefinition = DeepReadonly<IndicatorDefinition>;
type ReadonlyClassificationCode = DeepReadonly<ClassificationCode>;

export interface PeriodFilter {
  granularity?: Period["granularity"];
  label?: string;
  start?: string;
  end?: string;
}

export interface ProductCatalogView {
  readonly productId: string;
  readonly item: ReadonlyItem;
  readonly directChildCount: number;
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly sources: readonly ReadonlySource[];
  readonly warnings: readonly string[];
}

export interface ProductOverviewView {
  readonly product: ReadonlyItem;
  readonly directChildren: readonly ReadonlyItem[];
  readonly period: ReadonlyPeriod;
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly sources: readonly ReadonlySource[];
  readonly warnings: readonly string[];
}

export interface ProductBreakdownNode {
  readonly item: ReadonlyItem;
  readonly depth: number;
  readonly children: readonly ProductBreakdownNode[];
}

export interface ResolvedStoryNodeView {
  readonly node: ReadonlyStoryNode;
  readonly entity: ReadonlyGeoEntity | null;
  readonly item: ReadonlyItem | null;
  readonly processStage: ReadonlyProcessStage | null;
}

export interface StoryEndpointView {
  readonly referenceId: string;
  readonly node: ResolvedStoryNodeView | null;
  readonly entity: ReadonlyGeoEntity | null;
}

export interface ResolvedSupplyFlowView {
  readonly flow: ReadonlySupplyFlow;
  readonly from: StoryEndpointView;
  readonly to: StoryEndpointView;
  readonly item: ReadonlyItem | null;
  readonly processStage: ReadonlyProcessStage | null;
}

export interface SupplyChainStoryView {
  readonly product: ReadonlyItem;
  readonly period: ReadonlyPeriod;
  readonly nodes: readonly ResolvedStoryNodeView[];
  readonly flows: readonly ResolvedSupplyFlowView[];
  readonly steps: readonly ReadonlyStoryStep[];
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly sources: readonly ReadonlySource[];
  readonly warnings: readonly string[];
}

export interface SupplyChainNodeView {
  readonly node: ResolvedStoryNodeView;
  readonly incomingFlows: readonly ResolvedSupplyFlowView[];
  readonly outgoingFlows: readonly ResolvedSupplyFlowView[];
  readonly productionActivities: readonly ReadonlyProductionActivity[];
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ReadonlyEvidence[];
  readonly warnings: readonly string[];
}

export interface SupplyChainStoryOptions extends PeriodFilter {
  /** Focuses a route on an item and all of its configured descendants. */
  readonly focusItemId?: string;
  readonly processStageIds?: readonly string[];
}

export interface CountryLedgerView {
  readonly product: ReadonlyItem;
  readonly entity: ReadonlyGeoEntity;
  readonly period: ReadonlyPeriod;
  readonly tradeObservations: readonly ReadonlyTradeObservation[];
  readonly resolvedTradeObservations: readonly ResolvedTradeObservationView[];
  readonly macroIndicators: readonly ReadonlyMacroIndicatorObservation[];
  readonly resolvedMacroIndicators: readonly ResolvedMacroIndicatorView[];
  readonly tradeClassifications: readonly ReadonlyClassificationCode[];
  readonly tradeAvailability: "available" | "unknown";
  readonly tradeAvailabilityNote: string | null;
  readonly relatedNodes: readonly ResolvedStoryNodeView[];
  readonly relatedFlows: readonly ResolvedSupplyFlowView[];
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly sources: readonly ReadonlySource[];
  readonly warnings: readonly string[];
}

export interface ResolvedTradeObservationView {
  readonly observation: ReadonlyTradeObservation;
  readonly reporter: ReadonlyGeoEntity | null;
  readonly partner: ReadonlyGeoEntity | null;
  readonly item: ReadonlyItem | null;
  readonly classification: ReadonlyClassificationCode | null;
  /** Alias retained for consumers that prefer the explicit field name. */
  readonly classificationCode: ReadonlyClassificationCode | null;
  readonly source: ReadonlySource | null;
  readonly partnerScope: "world_total" | "entity" | "unspecified" | "not_applicable";
  readonly valueDataStatus: FactStatus;
  readonly quantityDataStatus: FactStatus;
}

export interface IndicatorDefinitionView {
  readonly key: string;
  readonly label: string;
  readonly shortLabel: string | null;
  readonly description: string | null;
  readonly category: string | null;
  readonly displayOrder: number | null;
  readonly displayUnit: string | null;
  readonly displayCurrency: string | null;
  readonly valueMeaning: string | null;
  readonly sourceIndicatorCode: string | null;
  readonly statisticalConcept: MacroIndicatorObservation["statisticalConcept"];
  readonly formula: string | null;
  readonly source: ReadonlySource | null;
  readonly metadataStatus: "defined" | "fallback";
  readonly raw: ReadonlyIndicatorDefinition | null;
}

export interface ResolvedMacroIndicatorView {
  readonly observation: ReadonlyMacroIndicatorObservation;
  readonly definition: IndicatorDefinitionView;
  readonly source: ReadonlySource | null;
}

export interface CountryLedgerOptions extends PeriodFilter {
  readonly itemId?: string;
}

export interface ProvenanceOptions {
  readonly sourceIds?: readonly string[];
  readonly evidenceIds?: readonly string[];
}

export interface ProvenanceView {
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ReadonlyEvidence[];
  readonly indicatorDefinitions: readonly ReadonlyIndicatorDefinition[];
  readonly missingDataNotes: readonly string[];
  readonly warnings: readonly string[];
}

export interface ProductQueryService {
  listProducts(): readonly ProductCatalogView[];
  getProductOverview(productId: string): ProductOverviewView | null;
  getProductBreakdown(productId: string): ProductBreakdownNode | null;
  getSupplyChainStory(
    productId: string,
    options?: SupplyChainStoryOptions
  ): SupplyChainStoryView | null;
  getSupplyChainNode(productId: string, nodeId: string): SupplyChainNodeView | null;
  getCountryLedger(
    productId: string,
    entityId: string,
    options?: CountryLedgerOptions
  ): CountryLedgerView | null;
  getProvenance(productId: string, options?: ProvenanceOptions): ProvenanceView | null;
}

export class DomainQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainQueryError";
  }
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function mergeWarnings(...warningLists: ReadonlyArray<readonly string[]>): readonly string[] {
  return freezeArray([...new Set(warningLists.flat())]);
}

function sourceForId(
  fixture: ReadonlyProductFixture,
  sourceId: string | null | undefined
): ReadonlySource | null {
  return sourceId ? fixture.sources.find((source) => source.id === sourceId) ?? null : null;
}

function definitionForIndicator(
  fixture: ReadonlyProductFixture,
  observation: ReadonlyMacroIndicatorObservation
): IndicatorDefinitionView {
  const configured = fixture.indicatorDefinitions.find(
    (definition) => definition.indicator === observation.indicator
  );
  if (!configured) {
    return Object.freeze({
      key: observation.indicator,
      label: observation.indicator,
      shortLabel: null,
      description: observation.notes ?? null,
      category: null,
      displayOrder: null,
      displayUnit: null,
      displayCurrency: null,
      valueMeaning: null,
      sourceIndicatorCode: null,
      statisticalConcept: observation.statisticalConcept ?? null,
      formula: null,
      source: sourceForId(fixture, observation.sourceId),
      metadataStatus: "fallback",
      raw: null
    });
  }

  return Object.freeze({
    key: configured.indicator,
    label: configured.label,
    shortLabel: configured.shortLabel ?? null,
    description: configured.description ?? null,
    category: configured.category ?? null,
    displayOrder: configured.displayOrder ?? null,
    displayUnit: configured.displayUnit ?? null,
    displayCurrency: configured.displayCurrency ?? null,
    valueMeaning: configured.valueMeaning ?? null,
    sourceIndicatorCode: configured.sourceIndicatorCode ?? null,
    statisticalConcept:
      configured.statisticalConcept ?? observation.statisticalConcept ?? null,
    formula: configured.formula ?? null,
    source: sourceForId(fixture, configured.sourceIds[0]),
    metadataStatus: "defined",
    raw: configured
  });
}

function resolveMacroIndicator(
  fixture: ReadonlyProductFixture,
  observation: ReadonlyMacroIndicatorObservation
): ResolvedMacroIndicatorView {
  return Object.freeze({
    observation,
    definition: definitionForIndicator(fixture, observation),
    source: sourceForId(fixture, observation.sourceId)
  });
}

function classificationForObservation(
  fixture: ReadonlyProductFixture,
  observation: ReadonlyTradeObservation
): ReadonlyClassificationCode | null {
  return (
    fixture.classificationCodes.find(
      (classification) =>
        classification.system === observation.classificationSystem &&
        classification.version === observation.classificationVersion &&
        classification.code === observation.classificationCode
    ) ?? null
  );
}

function tradePartnerScope(
  observation: ReadonlyTradeObservation
): "world_total" | "entity" | "unspecified" | "not_applicable" {
  if (observation.partnerScope) return observation.partnerScope;
  if (observation.partnerEntityId) return "entity";
  return "unspecified";
}

function tradeValueDataStatus(observation: ReadonlyTradeObservation): FactStatus {
  return observation.valueDataStatus ?? observation.dataStatus;
}

function tradeQuantityDataStatus(observation: ReadonlyTradeObservation): FactStatus {
  return observation.quantityDataStatus ??
    (observation.quantity === null || observation.quantity === undefined
      ? "unknown"
      : observation.dataStatus);
}

function matchesPeriod(period: ReadonlyPeriod, filter?: PeriodFilter): boolean {
  if (!filter) return true;
  if (filter.granularity && period.granularity !== filter.granularity) return false;
  if (filter.label && period.label !== filter.label) return false;
  if (filter.start && period.start !== filter.start) return false;
  if (filter.end && period.end !== filter.end) return false;
  return true;
}

function getProductItem(
  fixture: ReadonlyProductFixture
): ReadonlyItem | undefined {
  return fixture.items.find((item) => item.id === fixture.productId);
}

function getFixtureOrNull(
  repository: FixtureRepository,
  productId: string
): ReadonlyProductFixture | null {
  return repository.getProductFixture(productId) ?? null;
}

function getDescendantItemIds(
  fixture: ReadonlyProductFixture,
  rootItemId: string
): Set<string> {
  const itemIds = new Set<string>([rootItemId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const item of fixture.items) {
      if (item.parentItemId && itemIds.has(item.parentItemId) && !itemIds.has(item.id)) {
        itemIds.add(item.id);
        changed = true;
      }
    }
  }

  return itemIds;
}

function buildBreakdown(
  fixture: ReadonlyProductFixture,
  itemId: string,
  depth: number,
  ancestors: ReadonlySet<string>
): ProductBreakdownNode {
  const item = fixture.items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new DomainQueryError(`Unknown item in product breakdown: ${itemId}`);
  }
  if (ancestors.has(itemId)) {
    throw new DomainQueryError(`Cycle detected in product breakdown at item: ${itemId}`);
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(itemId);
  const children = fixture.items
    .filter((candidate) => candidate.parentItemId === itemId)
    .map((candidate) => buildBreakdown(fixture, candidate.id, depth + 1, nextAncestors));

  return Object.freeze({
    item,
    depth,
    children: freezeArray(children)
  });
}

function resolveStoryNode(
  fixture: ReadonlyProductFixture,
  node: ReadonlyStoryNode
): ResolvedStoryNodeView {
  return Object.freeze({
    node,
    entity: node.entityId
      ? fixture.entities.find((entity) => entity.id === node.entityId) ?? null
      : null,
    item: node.itemId
      ? fixture.items.find((item) => item.id === node.itemId) ?? null
      : null,
    processStage: node.processStageId
      ? fixture.processStages.find((stage) => stage.id === node.processStageId) ?? null
      : null
  });
}

function resolveEndpoint(
  fixture: ReadonlyProductFixture,
  nodeById: ReadonlyMap<string, ResolvedStoryNodeView>,
  referenceId: string
): StoryEndpointView {
  const node = nodeById.get(referenceId) ?? null;
  const entity =
    node?.entity ?? fixture.entities.find((candidate) => candidate.id === referenceId) ?? null;

  return Object.freeze({
    referenceId,
    node,
    entity
  });
}

function createStoryView(
  fixture: ReadonlyProductFixture,
  options?: SupplyChainStoryOptions
): SupplyChainStoryView {
  const product = getProductItem(fixture);
  if (!product) {
    throw new DomainQueryError(`Fixture product item is missing: ${fixture.productId}`);
  }

  const itemIds = new Set(fixture.items.map((item) => item.id));
  const focusItemIds = options?.focusItemId
    ? getDescendantItemIds(fixture, options.focusItemId)
    : null;
  if (options?.focusItemId && !itemIds.has(options.focusItemId)) {
    throw new DomainQueryError(`Unknown focus item: ${options.focusItemId}`);
  }
  const processStageIds = options?.processStageIds
    ? new Set(options.processStageIds)
    : null;
  const flowMatches = (flow: ReadonlySupplyFlow) =>
    (!focusItemIds || focusItemIds.has(flow.itemId)) &&
    (!processStageIds || processStageIds.has(flow.processStageId)) &&
    matchesPeriod(flow.period, options);

  const selectedFlows = fixture.storyGraph.flows.filter(flowMatches);
  const selectedFlowIds = new Set(selectedFlows.map((flow) => flow.id));
  const selectedEndpointRefs = new Set(
    selectedFlows.flatMap((flow) => [flow.fromEntityId, flow.toEntityId])
  );
  const allResolvedNodes = new Map(
    fixture.storyGraph.nodes.map((node) => [node.id, resolveStoryNode(fixture, node)])
  );
  const selectedNodes = fixture.storyGraph.nodes
    .filter((node) => {
      if (!focusItemIds && !processStageIds) return true;
      const itemMatches = !!node.itemId && !!focusItemIds?.has(node.itemId);
      const stageMatches =
        !processStageIds || (!!node.processStageId && processStageIds.has(node.processStageId));
      return (itemMatches && stageMatches) || selectedEndpointRefs.has(node.id);
    })
    .map((node) => allResolvedNodes.get(node.id) as ResolvedStoryNodeView);

  const selectedNodeIds = new Set(selectedNodes.map((node) => node.node.id));
  const resolvedFlows = selectedFlows.map((flow) =>
    Object.freeze({
      flow,
      from: resolveEndpoint(fixture, allResolvedNodes, flow.fromEntityId),
      to: resolveEndpoint(fixture, allResolvedNodes, flow.toEntityId),
      item: fixture.items.find((item) => item.id === flow.itemId) ?? null,
      processStage:
        fixture.processStages.find((stage) => stage.id === flow.processStageId) ?? null
    })
  );
  const selectedSteps = fixture.storyGraph.steps
    .filter((step) => {
    if (
      !focusItemIds &&
      !processStageIds &&
      !options?.granularity &&
      !options?.label &&
      !options?.start &&
      !options?.end
    ) {
      return true;
    }
    return (
      step.flowIds.some((flowId) => selectedFlowIds.has(flowId)) ||
      step.nodeIds.some((nodeId) => selectedNodeIds.has(nodeId))
    );
    })
    .map((step) =>
      Object.freeze({
        ...step,
        nodeIds: freezeArray(step.nodeIds.filter((nodeId) => selectedNodeIds.has(nodeId))),
        flowIds: freezeArray(step.flowIds.filter((flowId) => selectedFlowIds.has(flowId)))
      })
    );

  return Object.freeze({
    product,
    period: fixture.storyGraph.period,
    nodes: freezeArray(selectedNodes),
    flows: freezeArray(resolvedFlows),
    steps: freezeArray(selectedSteps),
    datasetVersion: fixture.datasetVersion,
    sources: freezeArray(fixture.sources),
    warnings: mergeWarnings(fixture.warnings, fixture.storyGraph.warnings)
  });
}

export function listProducts(repository: FixtureRepository): readonly ProductCatalogView[] {
  const products = repository
    .listProductIds()
    .map((productId) => {
      const fixture = repository.getProductFixture(productId);
      const item = fixture ? getProductItem(fixture) : undefined;
      if (!fixture || !item) return null;
      return Object.freeze({
        productId,
        item,
        directChildCount: fixture.items.filter((candidate) => candidate.parentItemId === productId)
          .length,
        datasetVersion: fixture.datasetVersion,
        sources: freezeArray(fixture.sources),
        warnings: mergeWarnings(fixture.warnings, fixture.storyGraph.warnings)
      });
    })
    .filter((product): product is ProductCatalogView => product !== null)
    .sort((left, right) => left.item.name.localeCompare(right.item.name));

  return freezeArray(products);
}

export function getProductOverview(
  repository: FixtureRepository,
  productId: string
): ProductOverviewView | null {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return null;
  const product = getProductItem(fixture);
  if (!product) return null;

  return Object.freeze({
    product,
    directChildren: freezeArray(
      fixture.items.filter((item) => item.parentItemId === product.id)
    ),
    period: fixture.storyGraph.period,
    datasetVersion: fixture.datasetVersion,
    sources: freezeArray(fixture.sources),
    warnings: mergeWarnings(fixture.warnings, fixture.storyGraph.warnings)
  });
}

export function getProductBreakdown(
  repository: FixtureRepository,
  productId: string
): ProductBreakdownNode | null {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture || !getProductItem(fixture)) return null;
  return buildBreakdown(fixture, fixture.productId, 0, new Set());
}

export function getSupplyChainStory(
  repository: FixtureRepository,
  productId: string,
  options?: SupplyChainStoryOptions
): SupplyChainStoryView | null {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return null;
  return createStoryView(fixture, options);
}

export function getSupplyChainNode(
  repository: FixtureRepository,
  productId: string,
  nodeId: string
): SupplyChainNodeView | null {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return null;

  const story = createStoryView(fixture);
  const node = story.nodes.find((candidate) => candidate.node.id === nodeId);
  if (!node) return null;

  const incomingFlows = story.flows.filter(
    (flow) =>
      flow.to.referenceId === nodeId ||
      (!!node.entity?.id && !flow.to.node && flow.to.referenceId === node.entity.id)
  );
  const outgoingFlows = story.flows.filter(
    (flow) =>
      flow.from.referenceId === nodeId ||
      (!!node.entity?.id && !flow.from.node && flow.from.referenceId === node.entity.id)
  );
  const productionActivities = fixture.productionActivities.filter(
    (activity) =>
      !!node.entity?.id &&
      activity.locationEntityId === node.entity.id &&
      (!node.processStage?.id || activity.processStageId === node.processStage.id)
  );
  const sourceIdSet = new Set([
    ...node.node.sourceIds,
    ...incomingFlows.flatMap((flow) => flow.flow.sourceIds),
    ...outgoingFlows.flatMap((flow) => flow.flow.sourceIds),
    ...productionActivities.flatMap((activity) => activity.sourceIds)
  ]);
  const sources = fixture.sources.filter((source) => sourceIdSet.has(source.id));
  const evidence = fixture.evidence.filter((record) => sourceIdSet.has(record.sourceId));

  return Object.freeze({
    node,
    incomingFlows: freezeArray(incomingFlows),
    outgoingFlows: freezeArray(outgoingFlows),
    productionActivities: freezeArray(productionActivities),
    datasetVersion: fixture.datasetVersion,
    sources: freezeArray(sources),
    evidence: freezeArray(evidence),
    warnings: mergeWarnings(fixture.warnings, fixture.storyGraph.warnings)
  });
}

export function getCountryLedger(
  repository: FixtureRepository,
  productId: string,
  entityId: string,
  options?: CountryLedgerOptions
): CountryLedgerView | null {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return null;
  const product = getProductItem(fixture);
  const entity = fixture.entities.find((candidate) => candidate.id === entityId);
  if (!product || !entity) return null;

  const story = createStoryView(fixture, options);
  const tradeObservations = fixture.tradeObservations.filter(
    (observation) =>
      observation.reporterEntityId === entityId &&
      (!options?.itemId || observation.itemId === options.itemId) &&
      matchesPeriod(observation.period, options)
  );
  const macroIndicators = fixture.macroIndicators.filter(
    (observation) => observation.entityId === entityId && matchesPeriod(observation.period, options)
  );
  const sortedMacroIndicators = [...macroIndicators].sort((left, right) => {
    const leftDefinition = definitionForIndicator(fixture, left);
    const rightDefinition = definitionForIndicator(fixture, right);
    const leftOrder = leftDefinition.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = rightDefinition.displayOrder ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.indicator.localeCompare(right.indicator) || left.id.localeCompare(right.id);
  });
  const sortedTradeObservations = [...tradeObservations].sort(
    (left, right) =>
      left.direction.localeCompare(right.direction) ||
      left.classificationSystem.localeCompare(right.classificationSystem) ||
      left.classificationVersion.localeCompare(right.classificationVersion) ||
      left.classificationCode.localeCompare(right.classificationCode) ||
      left.id.localeCompare(right.id)
  );
  const resolvedTradeObservations = sortedTradeObservations.map((observation) => {
    const classification = classificationForObservation(fixture, observation);
    return Object.freeze({
      observation,
      reporter: fixture.entities.find((candidate) => candidate.id === observation.reporterEntityId) ?? null,
      partner: observation.partnerEntityId
        ? fixture.entities.find((candidate) => candidate.id === observation.partnerEntityId) ?? null
        : null,
      item: observation.itemId
        ? fixture.items.find((candidate) => candidate.id === observation.itemId) ?? null
        : null,
      classification,
      classificationCode: classification,
      source: sourceForId(fixture, observation.sourceId),
      partnerScope: tradePartnerScope(observation),
      valueDataStatus: tradeValueDataStatus(observation),
      quantityDataStatus: tradeQuantityDataStatus(observation)
    });
  });
  const sortedResolvedTradeObservations = [...resolvedTradeObservations].sort(
    (left, right) =>
      left.observation.direction.localeCompare(right.observation.direction) ||
      left.observation.classificationSystem.localeCompare(right.observation.classificationSystem) ||
      left.observation.classificationVersion.localeCompare(right.observation.classificationVersion) ||
      left.observation.classificationCode.localeCompare(right.observation.classificationCode) ||
      left.observation.id.localeCompare(right.observation.id)
  );
  const resolvedMacroIndicators = sortedMacroIndicators.map((observation) =>
    resolveMacroIndicator(fixture, observation)
  );
  const tradeItemId = options?.itemId ?? product.id;
  const tradeClassificationIds = new Set(
    fixture.classificationCrosswalks
      .filter((mapping) => mapping.itemId === tradeItemId && matchesPeriod(mapping.period, options))
      .map((mapping) => mapping.classificationCodeId)
  );
  const tradeClassifications = fixture.classificationCodes
    .filter((classification) => tradeClassificationIds.has(classification.id))
    .sort(
      (left, right) =>
        left.system.localeCompare(right.system) ||
        left.version.localeCompare(right.version) ||
        left.code.localeCompare(right.code)
    );
  const relatedNodes = story.nodes.filter((node) => node.entity?.id === entityId);
  const relatedFlows = story.flows.filter(
    (flow) => flow.from.entity?.id === entityId || flow.to.entity?.id === entityId
  );

  return Object.freeze({
    product,
    entity,
    period: fixture.storyGraph.period,
    tradeObservations: freezeArray(sortedTradeObservations),
    resolvedTradeObservations: freezeArray(sortedResolvedTradeObservations),
    macroIndicators: freezeArray(sortedMacroIndicators),
    resolvedMacroIndicators: freezeArray(resolvedMacroIndicators),
    tradeClassifications: freezeArray(tradeClassifications),
    tradeAvailability: sortedTradeObservations.length > 0 ? "available" : "unknown",
    tradeAvailabilityNote:
      sortedTradeObservations.length > 0
        ? null
        : "当前数据集没有该国家在所选期间的商品贸易观察；这不表示贸易额为 0。",
    relatedNodes: freezeArray(relatedNodes),
    relatedFlows: freezeArray(relatedFlows),
    datasetVersion: fixture.datasetVersion,
    sources: freezeArray(fixture.sources),
    warnings: mergeWarnings(fixture.warnings, fixture.storyGraph.warnings)
  });
}

export function getProvenance(
  repository: FixtureRepository,
  productId: string,
  options?: ProvenanceOptions
): ProvenanceView | null {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return null;

  const sourceIdSet = options?.sourceIds ? new Set(options.sourceIds) : null;
  const evidenceIdSet = options?.evidenceIds ? new Set(options.evidenceIds) : null;
  const sources = fixture.sources.filter(
    (source) => !sourceIdSet || sourceIdSet.has(source.id)
  );
  const evidence = fixture.evidence.filter((record) => {
    if (evidenceIdSet) return evidenceIdSet.has(record.id);
    return !sourceIdSet || sourceIdSet.has(record.sourceId);
  });
  const indicatorDefinitions = fixture.indicatorDefinitions.filter(
    (definition) => !sourceIdSet || definition.sourceIds.some((sourceId) => sourceIdSet.has(sourceId))
  );

  return Object.freeze({
    datasetVersion: fixture.datasetVersion,
    sources: freezeArray(sources),
    evidence: freezeArray(evidence),
    indicatorDefinitions: freezeArray(indicatorDefinitions),
    missingDataNotes: freezeArray(fixture.missingDataNotes),
    warnings: mergeWarnings(fixture.warnings, fixture.storyGraph.warnings)
  });
}

export function createProductQueryService(
  repository: FixtureRepository
): ProductQueryService {
  return Object.freeze({
    listProducts: () => listProducts(repository),
    getProductOverview: (productId: string) => getProductOverview(repository, productId),
    getProductBreakdown: (productId: string) => getProductBreakdown(repository, productId),
    getSupplyChainStory: (productId: string, options?: SupplyChainStoryOptions) =>
      getSupplyChainStory(repository, productId, options),
    getSupplyChainNode: (productId: string, nodeId: string) =>
      getSupplyChainNode(repository, productId, nodeId),
    getCountryLedger: (
      productId: string,
      entityId: string,
      options?: CountryLedgerOptions
    ) => getCountryLedger(repository, productId, entityId, options),
    getProvenance: (productId: string, options?: ProvenanceOptions) =>
      getProvenance(repository, productId, options)
  });
}
