import type {
  ClassificationCode,
  ClassificationCrosswalk,
  ContentVersion,
  DatasetVersion,
  Evidence,
  EvidenceGap,
  FactStatus,
  GeoEntity,
  IndicatorDefinition,
  Item,
  MacroIndicatorObservation,
  MaterialTradeObservation,
  ManufacturingProcessChain,
  ManufacturingRouteVariant,
  ManufacturingProcessStep,
  EquipmentCategory,
  ProcessRequirement,
  Organization,
  OrganizationCapability,
  Period,
  ProductionActivity,
  ProcessStage,
  Source,
  StoryNode,
  StoryStep,
  SupplyChainEvidenceLevel,
  SupplyFlow,
  PolicyDocument,
  TariffMeasure,
  TradeDocumentRequirement,
  TradeGuide,
  TradeProcedure,
  TradeProcedureStep,
  TradeRequirement,
  TradeObservation
} from "@globe-chain/contracts";
import type {
  DeepReadonly,
  FixtureRepository,
  ReadonlyProductFixture
} from "./repository";

type ReadonlyItem = DeepReadonly<Item>;
type ReadonlyGeoEntity = DeepReadonly<GeoEntity>;
type ReadonlyContentVersion = DeepReadonly<ContentVersion>;
type ReadonlyDatasetVersion = DeepReadonly<DatasetVersion>;
type ReadonlyEvidence = DeepReadonly<Evidence>;
type ReadonlyEvidenceGap = DeepReadonly<EvidenceGap>;
type ReadonlyPeriod = DeepReadonly<Period>;
type ReadonlyProductionActivity = DeepReadonly<ProductionActivity>;
type ReadonlyProcessStage = DeepReadonly<ProcessStage>;
type ReadonlySource = DeepReadonly<Source>;
type ReadonlyStoryNode = DeepReadonly<StoryNode>;
type ReadonlyStoryStep = DeepReadonly<StoryStep>;
type ReadonlySupplyFlow = DeepReadonly<SupplyFlow>;
type ReadonlyTradeObservation = DeepReadonly<TradeObservation>;
type ReadonlyMaterialTradeObservation = DeepReadonly<MaterialTradeObservation>;
type ReadonlyMacroIndicatorObservation = DeepReadonly<MacroIndicatorObservation>;
type ReadonlyIndicatorDefinition = DeepReadonly<IndicatorDefinition>;
type ReadonlyManufacturingProcessChain = DeepReadonly<ManufacturingProcessChain>;
type ReadonlyManufacturingRouteVariant = DeepReadonly<ManufacturingRouteVariant>;
type ReadonlyManufacturingProcessStep = DeepReadonly<ManufacturingProcessStep>;
type ReadonlyEquipmentCategory = DeepReadonly<EquipmentCategory>;
type ReadonlyProcessRequirement = DeepReadonly<ProcessRequirement>;
type ReadonlyOrganization = DeepReadonly<Organization>;
type ReadonlyOrganizationCapability = DeepReadonly<OrganizationCapability>;
type ReadonlyClassificationCode = DeepReadonly<ClassificationCode>;
type ReadonlyTradeGuide = DeepReadonly<TradeGuide>;
type ReadonlyTariffMeasure = DeepReadonly<TariffMeasure>;
type ReadonlyTradeRequirement = DeepReadonly<TradeRequirement>;
type ReadonlyTradeProcedure = DeepReadonly<TradeProcedure>;
type ReadonlyTradeProcedureStep = DeepReadonly<TradeProcedureStep>;
type ReadonlyTradeDocumentRequirement = DeepReadonly<TradeDocumentRequirement>;
type ReadonlyPolicyDocument = DeepReadonly<PolicyDocument>;

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

export interface CountryCatalogView {
  readonly entity: ReadonlyGeoEntity;
  readonly productIds: readonly string[];
  readonly ledgerProductIds: readonly string[];
  readonly relatedNodeCount: number;
  readonly hasTradeLedger: boolean;
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly roles: readonly string[];
}

export interface TradeNetworkObservationView {
  readonly observation: ReadonlyTradeObservation;
  readonly reporter: ReadonlyGeoEntity | null;
  readonly partner: ReadonlyGeoEntity | null;
  readonly item: ReadonlyItem | null;
  readonly source: ReadonlySource | null;
  readonly valueDataStatus: FactStatus;
  readonly quantityDataStatus: FactStatus;
}

export interface TradeNetworkView {
  readonly product: ReadonlyItem;
  readonly period: ReadonlyPeriod;
  readonly observations: readonly TradeNetworkObservationView[];
  readonly countries: readonly ReadonlyGeoEntity[];
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly warnings: readonly string[];
}

export interface TradeNetworkOptions extends PeriodFilter {
  readonly itemId?: string;
  readonly countryEntityId?: string;
  readonly direction?: TradeObservation["direction"];
}

/** Product and material statistics share display dimensions, never an implied common classification or total. */
export interface TradeMapObservationView {
  readonly recordKind: "product_trade" | "material_trade";
  readonly id: string;
  readonly item: ReadonlyItem | null;
  readonly reporter: ReadonlyGeoEntity | null;
  readonly partner: ReadonlyGeoEntity | null;
  readonly partnerScope: "world_total" | "entity" | "unspecified" | "not_applicable";
  readonly direction: TradeObservation["direction"];
  readonly period: ReadonlyPeriod;
  readonly value: number | null;
  readonly currency: string | null;
  readonly valueDataStatus: FactStatus;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly quantityDataStatus: FactStatus;
  readonly classification: {
    readonly system: string;
    readonly version: string;
    readonly code: string;
    readonly label: string | null;
    readonly mappingType: string | null;
  };
  readonly method: TradeObservation["method"];
  readonly source: ReadonlySource | null;
  readonly datasetVersion: ReadonlyDatasetVersion | null;
  readonly limitation: string | null;
}

export interface TradeMapItemCoverage {
  readonly item: ReadonlyItem;
  readonly directObservationCount: number;
  readonly relatedObservationCount: number;
}

export interface TradeMapView {
  readonly product: ReadonlyItem;
  readonly selectedItem: ReadonlyItem;
  readonly relatedItems: readonly ReadonlyItem[];
  readonly observations: readonly TradeMapObservationView[];
  /** Coverage is independent of country, direction and year filters. */
  readonly itemCoverage: readonly TradeMapItemCoverage[];
  readonly datasetVersion: ReadonlyDatasetVersion;
}

export interface TradeMapOptions extends PeriodFilter {
  readonly focusItemId?: string;
  readonly countryEntityId?: string;
  readonly direction?: TradeObservation["direction"];
}

export interface CategoryCatalogView {
  readonly category: string;
  readonly itemCount: number;
  readonly productIds: readonly string[];
  readonly publishedItemCount: number;
}

export interface ProductOverviewView {
  readonly statisticsPeriodLabel: string;
  readonly product: ReadonlyItem;
  readonly directChildren: readonly ReadonlyItem[];
  readonly period: ReadonlyPeriod;
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly sources: readonly ReadonlySource[];
  readonly warnings: readonly string[];
  readonly componentCoverage: readonly ComponentCoverageView[];
}

export type ComponentCoverageStatus = "route_published" | "partial_route" | "catalog_only";

export interface ComponentCoverageView {
  readonly item: ReadonlyItem;
  readonly status: ComponentCoverageStatus;
  /** Human-readable status supplied by the domain layer, not assembled by the page. */
  readonly statusLabel: string;
  readonly statusDescription: string;
  readonly hasInspectableStory: boolean;
  readonly nodeCount: number;
  readonly flowCount: number;
  readonly evidenceGapCount: number;
  readonly evidenceLevels: readonly EvidenceLevelView["code"][];
  readonly classificationMappings: readonly ComponentClassificationView[];
  readonly processChains: readonly ManufacturingProcessChainSummaryView[];
}

export interface ManufacturingProcessChainSummaryView {
  readonly id: string;
  readonly title: string;
  readonly item: ReadonlyItem | null;
  readonly stepCount: number;
  readonly equipmentCategoryCount: number;
  readonly manufacturerCount: number;
}

export interface ResolvedOrganizationCapabilityView {
  readonly capability: ReadonlyOrganizationCapability;
  readonly organization: ReadonlyOrganization | null;
  readonly headquarters: ReadonlyGeoEntity | null;
  readonly equipmentCategory: ReadonlyEquipmentCategory | null;
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ResolvedEvidenceView[];
  readonly relationshipLabel: string;
  readonly relationshipDescription: string;
}

export interface ResolvedProcessRequirementView {
  readonly requirement: ReadonlyProcessRequirement;
  readonly equipmentCategory: ReadonlyEquipmentCategory | null;
  readonly item: ReadonlyItem | null;
  readonly capabilities: readonly ResolvedOrganizationCapabilityView[];
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ResolvedEvidenceView[];
}

export interface ResolvedManufacturingProcessStepView {
  readonly step: ReadonlyManufacturingProcessStep;
  /** Resolved item dimensions so presentation code never needs to dereference IDs. */
  readonly inputItems: readonly ReadonlyItem[];
  readonly outputItems: readonly ReadonlyItem[];
  readonly datasetVersion: ReadonlyDatasetVersion | null;
  readonly contentVersion: ReadonlyContentVersion | null;
  readonly routeVariants: readonly ReadonlyManufacturingRouteVariant[];
  readonly requirements: readonly ResolvedProcessRequirementView[];
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ResolvedEvidenceView[];
}

export interface ManufacturingProcessChainView {
  readonly product: ReadonlyItem;
  readonly chain: ReadonlyManufacturingProcessChain;
  readonly item: ReadonlyItem | null;
  readonly componentItem: ReadonlyItem | null;
  readonly steps: readonly ResolvedManufacturingProcessStepView[];
  readonly routeVariants: readonly ReadonlyManufacturingRouteVariant[];
  readonly organizations: readonly ReadonlyOrganization[];
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ResolvedEvidenceView[];
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly contentVersion: ReadonlyContentVersion | null;
  readonly warnings: readonly string[];
}

export interface ComponentClassificationView {
  readonly classification: ReadonlyClassificationCode;
  readonly mappingType: Readonly<ClassificationCrosswalk>['mappingType'];
  readonly limitation: string;
  readonly supportsEndUse: boolean;
}

export interface ProductBreakdownNode {
  readonly item: ReadonlyItem;
  readonly depth: number;
  readonly children: readonly ProductBreakdownNode[];
}

export interface EvidenceLevelView {
  readonly code: SupplyChainEvidenceLevel;
  readonly label: string;
  readonly description: string;
  readonly supportsCountryRole: boolean;
  readonly supportsBilateralFlow: boolean;
  readonly isRepresentative: boolean;
}

export interface ResolvedEvidenceView {
  readonly evidence: ReadonlyEvidence;
  readonly source: ReadonlySource | null;
}

export interface ResolvedStoryNodeView {
  readonly node: ReadonlyStoryNode;
  readonly entity: ReadonlyGeoEntity | null;
  readonly item: ReadonlyItem | null;
  readonly processStage: ReadonlyProcessStage | null;
  readonly period: ReadonlyPeriod;
  readonly datasetVersion: ReadonlyDatasetVersion | null;
  readonly contentVersion: ReadonlyContentVersion | null;
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ResolvedEvidenceView[];
  readonly evidenceLevel: EvidenceLevelView;
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
  readonly datasetVersion: ReadonlyDatasetVersion | null;
  readonly contentVersion: ReadonlyContentVersion | null;
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ResolvedEvidenceView[];
  readonly evidenceLevel: EvidenceLevelView;
  readonly valueDataStatus: FactStatus;
  readonly quantityDataStatus: FactStatus;
}

export interface ResolvedProductionActivityView {
  readonly activity: ReadonlyProductionActivity;
  readonly entity: ReadonlyGeoEntity | null;
  readonly processStage: ReadonlyProcessStage | null;
  readonly inputs: readonly ReadonlyItem[];
  readonly outputs: readonly ReadonlyItem[];
  readonly datasetVersion: ReadonlyDatasetVersion | null;
  readonly contentVersion: ReadonlyContentVersion | null;
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ResolvedEvidenceView[];
  readonly evidenceLevel: EvidenceLevelView;
}

export interface ResolvedStoryStepView {
  readonly step: ReadonlyStoryStep;
  readonly nodes: readonly ResolvedStoryNodeView[];
  readonly flows: readonly ResolvedSupplyFlowView[];
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ResolvedEvidenceView[];
  readonly contentVersion: ReadonlyContentVersion | null;
}

export interface SupplyChainRouteProvenanceView {
  readonly period: ReadonlyPeriod;
  readonly method: StoryStep["method"];
  readonly representativeStatement: string | null;
  readonly methodology: readonly string[];
  readonly limitations: readonly string[];
  readonly contentVersion: ReadonlyContentVersion | null;
}

export interface SupplyChainStoryView {
  readonly product: ReadonlyItem;
  readonly period: ReadonlyPeriod;
  readonly nodes: readonly ResolvedStoryNodeView[];
  readonly flows: readonly ResolvedSupplyFlowView[];
  readonly steps: readonly ResolvedStoryStepView[];
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly route: SupplyChainRouteProvenanceView;
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ResolvedEvidenceView[];
  readonly evidenceGaps: readonly ResolvedEvidenceGapView[];
  readonly interpretationSummary: SupplyChainInterpretationSummary;
  readonly warnings: readonly string[];
}

export interface SupplyChainInterpretationItem {
  readonly code: "country_roles" | "direct_bilateral_flows" | "representative_connections" | "unknown_quantities";
  readonly label: string;
  readonly count: number;
  readonly description: string;
  readonly tone: "supported" | "direct" | "representative" | "unknown";
}

export interface SupplyChainInterpretationSummary {
  readonly mode: "route" | "evidence_only" | "empty";
  readonly title: string;
  readonly description: string;
  readonly items: readonly SupplyChainInterpretationItem[];
}

export interface SupplyChainNodeView {
  readonly node: ResolvedStoryNodeView;
  readonly incomingFlows: readonly ResolvedSupplyFlowView[];
  readonly outgoingFlows: readonly ResolvedSupplyFlowView[];
  readonly productionActivities: readonly ResolvedProductionActivityView[];
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ResolvedEvidenceView[];
  readonly evidenceGaps: readonly ResolvedEvidenceGapView[];
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

export interface MaterialTradeObservationView {
  readonly observation: ReadonlyMaterialTradeObservation;
  readonly reporter: ReadonlyGeoEntity | null;
  readonly partner: ReadonlyGeoEntity | null;
  readonly item: ReadonlyItem | null;
  readonly source: ReadonlySource | null;
  readonly partnerScope: ReadonlyMaterialTradeObservation["partnerScope"];
  readonly evidenceLevel: EvidenceLevelView;
  readonly relatedEvidenceGaps: readonly ResolvedEvidenceGapView[];
}

export interface MaterialTradeObservationOptions extends PeriodFilter {
  readonly materialItemId?: string;
  readonly reporterEntityId?: string;
  readonly partnerScope?: ReadonlyMaterialTradeObservation["partnerScope"];
  readonly flow?: ReadonlyMaterialTradeObservation["flow"];
  readonly classificationMappingType?: ReadonlyMaterialTradeObservation["classificationMappingType"];
}

export interface TradeGuideOptions extends PeriodFilter {
  readonly jurisdictionEntityId?: string;
  readonly direction?: ReadonlyTradeGuide["scope"]["direction"];
  readonly itemId?: string;
}

export interface TradeGuideTariffView {
  readonly measure: ReadonlyTariffMeasure;
  readonly measureTypeLabel: string;
  readonly rateTypeLabel: string;
  readonly applicabilityLabel: string;
  readonly displayValue: string;
}

export interface TradeGuideDocumentView {
  readonly document: ReadonlyTradeDocumentRequirement;
  readonly mandatoryStatusLabel: string;
}

export interface TradeGuideRequirementView {
  readonly requirement: ReadonlyTradeRequirement;
  readonly requirementTypeLabel: string;
  readonly applicabilityLabel: string;
  readonly evidenceLevelLabel: string;
  readonly documents: readonly TradeGuideDocumentView[];
}

export interface TradeGuideProcedureStepView {
  readonly step: ReadonlyTradeProcedureStep;
  readonly actorLabel: string;
  readonly channelLabel: string;
  readonly mandatoryStatusLabel: string;
  readonly documents: readonly TradeGuideDocumentView[];
}

export interface TradeGuideProcedureView {
  readonly procedure: ReadonlyTradeProcedure;
  readonly processingTimeLabel: string;
  readonly steps: readonly TradeGuideProcedureStepView[];
}

export interface TradeGuideView {
  readonly guide: ReadonlyTradeGuide;
  readonly jurisdiction: ReadonlyGeoEntity | null;
  readonly item: ReadonlyItem | null;
  readonly classification: ReadonlyClassificationCode | null;
  readonly directionLabel: string;
  /** User-facing explanation of whether the selected jurisdiction is the origin or destination. */
  readonly jurisdictionRoleLabel: string;
  readonly originScopeLabel: string;
  readonly regimeLabel: string;
  readonly scopeSummary: string;
  readonly coverageLabel: string;
  readonly reviewStatusLabel: string;
  readonly lastReviewedLabel: string;
  readonly nextReviewLabel: string | null;
  readonly tariffs: readonly TradeGuideTariffView[];
  readonly requirements: readonly TradeGuideRequirementView[];
  readonly procedures: readonly TradeGuideProcedureView[];
  readonly documents: readonly TradeGuideDocumentView[];
  readonly policyDocuments: readonly ReadonlyPolicyDocument[];
  readonly contentVersion: ReadonlyContentVersion | null;
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ResolvedEvidenceView[];
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
  readonly measurement: {
    readonly kind: "monetary" | "quantity";
    readonly value: number | null;
    readonly currency: string | null;
    readonly unit: string | null;
  };
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
  readonly contentVersions: readonly ReadonlyContentVersion[];
  readonly sources: readonly ReadonlySource[];
  readonly evidence: readonly ReadonlyEvidence[];
  readonly resolvedEvidence: readonly ResolvedEvidenceView[];
  readonly evidenceGaps: readonly ResolvedEvidenceGapView[];
  readonly route: SupplyChainRouteProvenanceView;
  readonly indicatorDefinitions: readonly ReadonlyIndicatorDefinition[];
  readonly missingDataNotes: readonly string[];
  readonly warnings: readonly string[];
}

export interface ProductResearchExportView {
  readonly formatVersion: "product-research-export.v1";
  readonly productId: string;
  readonly release: {
    readonly datasetVersion: ReadonlyDatasetVersion;
    readonly contentVersions: readonly ReadonlyContentVersion[];
    readonly period: ReadonlyPeriod;
  };
  readonly includedModules: readonly (
    | "catalog"
    | "supply_chain"
    | "trade_ledger"
    | "trade_guidance"
    | "material_trade"
    | "manufacturing_process"
    | "provenance"
    | "evidence_gaps"
  )[];
  readonly recordCounts: {
    readonly entities: number;
    readonly items: number;
    readonly storyNodes: number;
    readonly storyFlows: number;
    readonly tradeObservations: number;
    readonly tradeGuides: number;
    readonly tariffMeasures: number;
    readonly tradeRequirements: number;
    readonly tradeProcedures: number;
    readonly tradeProcedureSteps: number;
    readonly tradeDocumentRequirements: number;
    readonly policyDocuments: number;
    readonly materialTradeObservations: number;
    readonly macroIndicators: number;
    readonly sources: number;
    readonly evidence: number;
    readonly evidenceGaps: number;
    readonly manufacturingProcessChains: number;
    readonly manufacturingProcessSteps: number;
    readonly equipmentCategories: number;
    readonly organizations: number;
    readonly organizationCapabilities: number;
  };
  readonly interpretationRules: readonly {
    readonly code: string;
    readonly statement: string;
  }[];
  readonly snapshot: ReadonlyProductFixture;
}

export interface ResolvedEvidenceGapView {
  readonly gap: ReadonlyEvidenceGap;
  readonly node: ResolvedStoryNodeView | null;
  readonly flow: ResolvedSupplyFlowView | null;
  readonly evidence: readonly ResolvedEvidenceView[];
  readonly datasetVersion: ReadonlyDatasetVersion | null;
  readonly contentVersion: ReadonlyContentVersion | null;
}

export interface ProductQueryService {
  listProducts(): readonly ProductCatalogView[];
  listCountries(): readonly CountryCatalogView[];
  listCategories(): readonly CategoryCatalogView[];
  getTradeNetwork(productId: string, options?: TradeNetworkOptions): TradeNetworkView | null;
  getTradeMapView(productId: string, options?: TradeMapOptions): TradeMapView | null;
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
  getProductResearchExport(productId: string): ProductResearchExportView | null;
  getEvidenceGaps(productId: string): readonly ResolvedEvidenceGapView[];
  getMaterialTradeObservations(productId: string, options?: MaterialTradeObservationOptions): readonly MaterialTradeObservationView[];
  getMaterialTradeObservation(productId: string, observationId: string): MaterialTradeObservationView | null;
  getTradeGuides(productId: string, options?: TradeGuideOptions): readonly TradeGuideView[];
  getTradeGuide(productId: string, guideId: string): TradeGuideView | null;
  getManufacturingProcessChain(productId: string, processChainId: string): ManufacturingProcessChainView | null;
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

function datasetVersionForId(
  fixture: ReadonlyProductFixture,
  datasetVersionId: string | null | undefined
): ReadonlyDatasetVersion | null {
  return datasetVersionId === fixture.datasetVersion.id ? fixture.datasetVersion : null;
}

function contentVersionForId(
  fixture: ReadonlyProductFixture,
  contentVersionId: string | null | undefined
): ReadonlyContentVersion | null {
  return contentVersionId
    ? fixture.contentVersions.find((version) => version.id === contentVersionId) ?? null
    : null;
}

function sourcesForIds(
  fixture: ReadonlyProductFixture,
  sourceIds: readonly string[]
): readonly ReadonlySource[] {
  const selected = new Set(sourceIds);
  return freezeArray(fixture.sources.filter((source) => selected.has(source.id)));
}

function resolveEvidenceRecords(
  fixture: ReadonlyProductFixture,
  evidenceIds: readonly string[],
  legacySourceIds: readonly string[] = []
): readonly ResolvedEvidenceView[] {
  const selectedEvidenceIds = new Set(evidenceIds);
  const allowLegacySourceFallback =
    selectedEvidenceIds.size === 0 && fixture.datasetVersion.status !== "published";
  const legacySourceIdSet = new Set(legacySourceIds);
  const evidence = fixture.evidence.filter((record) =>
    selectedEvidenceIds.size > 0
      ? selectedEvidenceIds.has(record.id)
      : allowLegacySourceFallback && legacySourceIdSet.has(record.sourceId)
  );

  return freezeArray(
    evidence.map((record) =>
      Object.freeze({
        evidence: record,
        source: sourceForId(fixture, record.sourceId)
      })
    )
  );
}

function uniqueSources(
  values: readonly (ReadonlySource | null)[]
): readonly ReadonlySource[] {
  const byId = new Map<string, ReadonlySource>();
  for (const value of values) {
    if (value) byId.set(value.id, value);
  }
  return freezeArray([...byId.values()]);
}

function uniqueResolvedEvidence(
  values: readonly ResolvedEvidenceView[]
): readonly ResolvedEvidenceView[] {
  const byId = new Map<string, ResolvedEvidenceView>();
  for (const value of values) byId.set(value.evidence.id, value);
  return freezeArray([...byId.values()]);
}

const evidenceLevelViews: Readonly<Record<SupplyChainEvidenceLevel, EvidenceLevelView>> =
  Object.freeze({
    role_supported: Object.freeze({
      code: "role_supported",
      label: "来源支持的国家角色",
      description:
        "证据支持该国家或地区在相关材料、商品或生产环节中的角色，但不自动证明与相邻节点之间的双边流向。",
      supportsCountryRole: true,
      supportsBilateralFlow: false,
      isRepresentative: false
    }),
    bilateral_supported: Object.freeze({
      code: "bilateral_supported",
      label: "来源支持的双边流向",
      description: "证据直接支持所示起点、终点和流向；数量仍按独立数据状态解释。",
      supportsCountryRole: true,
      supportsBilateralFlow: true,
      isRepresentative: false
    }),
    representative: Object.freeze({
      code: "representative",
      label: "代表性策展连接",
      description:
        "该节点或连接用于解释典型供应链结构，来源只支持背景、阶段或部分端点角色，不构成确定双边贸易路线证明。",
      supportsCountryRole: false,
      supportsBilateralFlow: false,
      isRepresentative: true
    }),
    none: Object.freeze({
      code: "none",
      label: "无直接支持证据",
      description: "当前内容版本没有可发布的直接证据支持该具体供应链主张。",
      supportsCountryRole: false,
      supportsBilateralFlow: false,
      isRepresentative: false
    })
  });

function evidenceLevelView(level: SupplyChainEvidenceLevel): EvidenceLevelView {
  return evidenceLevelViews[level];
}

const tradeDirectionLabels: Record<"import" | "export", string> = {
  import: "进口",
  export: "出口"
};

const tradeJurisdictionRoleLabels: Record<"import" | "export", string> = {
  import: "进口目的地/管辖区",
  export: "出口起运地/管辖区"
};

const tradeOriginScopeLabels: Record<string, string> = {
  all_origins: "所有原产地",
  specific_origin: "指定原产地",
  preferential_agreement: "优惠协定原产地",
  unknown: "原产地待核验"
};

const tradeRegimeLabels: Record<string, string> = {
  standard: "一般贸易规则",
  preferential: "优惠贸易规则",
  transit: "过境/转运规则",
  temporary: "暂时进出境规则",
  other: "其他规则"
};

const tradeCoverageLabels: Record<string, string> = {
  available: "资料较完整",
  partial: "部分覆盖",
  not_available: "暂无可用资料",
  not_publicly_observable: "公开资料不可观测"
};

const tradeReviewStatusLabels: Record<string, string> = {
  draft: "整理中",
  validated: "已校验",
  published: "已发布",
  deprecated: "已下线"
};

const tariffMeasureLabels: Record<string, string> = {
  customs_duty: "关税",
  preferential_duty: "优惠关税",
  vat: "进口环节增值税",
  excise: "消费税",
  anti_dumping: "反倾销措施",
  safeguard: "保障措施",
  export_tax: "出口税费",
  quota: "配额",
  other: "其他费用/措施"
};

const tariffRateLabels: Record<string, string> = {
  ad_valorem: "从价税",
  specific: "从量税",
  compound: "复合税",
  free: "免税",
  prohibited: "禁止",
  quota: "配额管理",
  unknown: "税率未收录"
};

const policyApplicabilityLabels: Record<string, string> = {
  required: "通常需要",
  conditional: "视情况而定",
  recommended: "建议准备",
  prohibited: "禁止",
  not_applicable: "不适用",
  unknown: "待核验"
};

const requirementTypeLabels: Record<string, string> = {
  import_license: "进口许可证",
  export_license: "出口许可证",
  customs_declaration: "海关申报",
  registration: "主体登记",
  conformity: "产品合规",
  labeling: "标签与说明",
  origin_proof: "原产地证明",
  inspection: "检验检疫",
  sanction: "制裁/禁限措施",
  prohibited: "禁止进口/出口",
  restricted: "限制管理",
  quota: "配额",
  tax_registration: "税务登记",
  other: "其他要求"
};

const policyEvidenceLevelLabels: Record<string, string> = {
  official_legal: "官方法律文本",
  official_guidance: "官方办事指引",
  international: "国际组织资料",
  secondary: "二手资料",
  curated: "人工整理",
  none: "暂无证据"
};

const actorLabels: Record<string, string> = {
  trader: "进出口企业",
  customs_broker: "报关代理",
  authority: "主管机关",
  carrier: "承运人",
  other: "其他参与方"
};

const channelLabels: Record<string, string> = {
  online: "线上系统",
  office: "办事窗口",
  port: "口岸现场",
  unknown: "渠道待核验"
};

function guidanceRateDisplay(measure: ReadonlyTariffMeasure): string {
  if (measure.dataStatus === "unknown") return "未收录（按原产地、归类和日期核验）";
  if (measure.dataStatus === "withheld") return "未披露";
  if (measure.dataStatus === "estimated") return measure.rateValue === null ? "估算值未提供" : `约 ${measure.rateValue}${measure.rateUnit ? ` ${measure.rateUnit}` : "%"}`;
  if (measure.rateValue === null) return tariffRateLabels[measure.rateType] ?? "未提供";
  if (measure.rateType === "free" || measure.rateValue === 0) return "0（来源报告为零/免税）";
  return `${measure.rateValue}${measure.rateUnit ? ` ${measure.rateUnit}` : "%"}`;
}

function resolveTradeDocumentView(
  document: ReadonlyTradeDocumentRequirement
): TradeGuideDocumentView {
  return Object.freeze({
    document,
    mandatoryStatusLabel: policyApplicabilityLabels[document.mandatoryStatus] ?? document.mandatoryStatus
  });
}

function resolveTradeGuideView(
  fixture: ReadonlyProductFixture,
  guide: ReadonlyTradeGuide
): TradeGuideView {
  const documentById = new Map(
    (fixture.tradeDocumentRequirements ?? [])
      .filter((document) => document.guideId === guide.id)
      .map((document) => [document.id, resolveTradeDocumentView(document)])
  );
  const documents = freezeArray([...documentById.values()]);
  const guideEvidence = resolveEvidenceRecords(fixture, guide.evidenceIds, guide.sourceIds);
  const guideSources = sourcesForIds(fixture, guide.sourceIds);
  const tariffs = freezeArray((fixture.tariffMeasures ?? [])
    .filter((measure) => measure.guideId === guide.id)
    .map((measure) => Object.freeze({
      measure,
      measureTypeLabel: tariffMeasureLabels[measure.measureType] ?? measure.measureType,
      rateTypeLabel: tariffRateLabels[measure.rateType] ?? measure.rateType,
      applicabilityLabel: policyApplicabilityLabels[measure.applicability] ?? measure.applicability,
      displayValue: guidanceRateDisplay(measure)
    })));
  const requirements = freezeArray((fixture.tradeRequirements ?? [])
    .filter((requirement) => requirement.guideId === guide.id)
    .map((requirement) => Object.freeze({
      requirement,
      requirementTypeLabel: requirementTypeLabels[requirement.requirementType] ?? requirement.requirementType,
      applicabilityLabel: policyApplicabilityLabels[requirement.applicability] ?? requirement.applicability,
      evidenceLevelLabel: policyEvidenceLevelLabels[requirement.evidenceLevel] ?? requirement.evidenceLevel,
      documents: freezeArray(requirement.documentRequirementIds.map((id) => documentById.get(id)).filter((document): document is TradeGuideDocumentView => Boolean(document)))
    })));
  const procedures = freezeArray((fixture.tradeProcedures ?? [])
    .filter((procedure) => procedure.guideId === guide.id)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((procedure) => {
      const steps = freezeArray(procedure.stepIds
        .map((stepId) => (fixture.tradeProcedureSteps ?? []).find((step) => step.id === stepId))
        .filter((step): step is ReadonlyTradeProcedureStep => Boolean(step))
        .sort((left, right) => left.order - right.order)
        .map((step) => Object.freeze({
          step,
          actorLabel: actorLabels[step.actorType] ?? step.actorType,
          channelLabel: channelLabels[step.channel] ?? step.channel,
          mandatoryStatusLabel: policyApplicabilityLabels[step.mandatoryStatus] ?? step.mandatoryStatus,
          documents: freezeArray(step.documentRequirementIds.map((id) => documentById.get(id)).filter((document): document is TradeGuideDocumentView => Boolean(document)))
        })));
      return Object.freeze({
        procedure,
        processingTimeLabel: procedure.processingTime.value === null
          ? "未提供"
          : `${procedure.processingTime.value} ${procedure.processingTime.unit ?? ""}`.trim(),
        steps
      });
    }));
  const policyDocuments = freezeArray((fixture.policyDocuments ?? []).filter((document) => document.jurisdictionEntityId === guide.scope.jurisdictionEntityId && guide.sourceIds.includes(document.sourceId)));
  const evidence = uniqueResolvedEvidence([
    ...guideEvidence,
    ...requirements.flatMap((view) => resolveEvidenceRecords(fixture, view.requirement.evidenceIds, view.requirement.sourceIds)),
    ...tariffs.flatMap((view) => resolveEvidenceRecords(fixture, view.measure.evidenceIds, view.measure.sourceIds)),
    ...procedures.flatMap((view) => [
      ...resolveEvidenceRecords(fixture, view.procedure.evidenceIds, view.procedure.sourceIds),
      ...view.steps.flatMap((step) => resolveEvidenceRecords(fixture, step.step.evidenceIds, step.step.sourceIds))
    ]),
    ...documents.flatMap((view) => resolveEvidenceRecords(fixture, view.document.evidenceIds, view.document.sourceIds)),
    ...policyDocuments.flatMap((document) => resolveEvidenceRecords(fixture, document.evidenceIds, document.sourceIds))
  ]);
  const sources = uniqueSources([
    ...guideSources,
    ...evidence.map((record) => record.source),
    ...policyDocuments.map((document) => sourceForId(fixture, document.sourceId))
  ]);
  const item = guide.scope.itemId
    ? fixture.items.find((candidate) => candidate.id === guide.scope.itemId) ?? null
    : null;
  const classification = guide.scope.classification
    ? fixture.classificationCodes.find((candidate) => candidate.system === guide.scope.classification?.system && candidate.version === guide.scope.classification?.version && candidate.code === guide.scope.classification?.code) ?? null
    : null;
  const jurisdiction = fixture.entities.find((entity) => entity.id === guide.scope.jurisdictionEntityId) ?? null;
  const jurisdictionName = jurisdiction?.name ?? "未指定国家/地区";
  return Object.freeze({
    guide,
    jurisdiction,
    item,
    classification,
    directionLabel: tradeDirectionLabels[guide.scope.direction],
    jurisdictionRoleLabel: tradeJurisdictionRoleLabels[guide.scope.direction],
    originScopeLabel: tradeOriginScopeLabels[guide.scope.originScope] ?? guide.scope.originScope,
    regimeLabel: tradeRegimeLabels[guide.scope.regime] ?? guide.scope.regime,
    scopeSummary: `${tradeJurisdictionRoleLabels[guide.scope.direction]}：${jurisdictionName}`,
    coverageLabel: tradeCoverageLabels[guide.coverageStatus] ?? guide.coverageStatus,
    reviewStatusLabel: tradeReviewStatusLabels[guide.reviewStatus] ?? guide.reviewStatus,
    lastReviewedLabel: guide.lastReviewedAt,
    nextReviewLabel: guide.nextReviewAt ?? null,
    tariffs,
    requirements,
    procedures,
    documents,
    policyDocuments,
    contentVersion: contentVersionForId(fixture, guide.contentVersionId),
    datasetVersion: fixture.datasetVersion,
    sources,
    evidence,
    warnings: mergeWarnings(fixture.warnings, guide.limitations, ["政策指南是静态人工整理的查询起点；税率、许可和产品要求必须在官方系统按当前日期、原产地和规格复核。"])
  });
}

function createRouteProvenance(
  fixture: ReadonlyProductFixture
): SupplyChainRouteProvenanceView {
  return Object.freeze({
    period: fixture.storyGraph.period,
    method: fixture.storyGraph.method,
    representativeStatement: fixture.storyGraph.representativeStatement ?? null,
    methodology: freezeArray(fixture.storyGraph.methodology),
    limitations: freezeArray(fixture.storyGraph.limitations),
    contentVersion: contentVersionForId(fixture, fixture.storyGraph.contentVersionId)
  });
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
    source: sourceForId(fixture, observation.sourceId),
    measurement: Object.freeze((observation.value !== null && observation.value !== undefined) || observation.quantity === null || observation.quantity === undefined ? {
      kind: "monetary" as const,
      value: observation.value ?? null,
      currency: observation.currency ?? null,
      unit: observation.unit ?? null
    } : {
      kind: "quantity" as const,
      value: observation.quantity ?? null,
      currency: null,
      unit: observation.unit ?? null
    })
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

function statisticsPeriodLabel(records: readonly { readonly period: ReadonlyPeriod }[]): string {
  const labels = [...new Set(records.map((record) => record.period.label))].sort();
  return labels.length ? labels.join(" / ") : "无统计记录";
}

function statisticsPeriod(records: readonly { readonly period: ReadonlyPeriod }[], fallback: ReadonlyPeriod): ReadonlyPeriod {
  if (!records.length) return fallback;
  const periods = records.map((record) => record.period);
  return Object.freeze({ ...periods[0], start: periods.map((p) => p.start).sort()[0], end: periods.map((p) => p.end).sort().at(-1)!, label: statisticsPeriodLabel(records) });
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
  const evidence = resolveEvidenceRecords(fixture, node.evidenceIds, node.sourceIds);
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
      : null,
    period: node.period ?? fixture.storyGraph.period,
    datasetVersion: datasetVersionForId(fixture, node.datasetVersionId),
    contentVersion: contentVersionForId(fixture, node.contentVersionId),
    sources: uniqueSources([
      ...sourcesForIds(fixture, node.sourceIds),
      ...evidence.map((record) => record.source)
    ]),
    evidence,
    evidenceLevel: evidenceLevelView(node.evidenceLevel)
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

function resolveSupplyFlow(
  fixture: ReadonlyProductFixture,
  nodeById: ReadonlyMap<string, ResolvedStoryNodeView>,
  flow: ReadonlySupplyFlow
): ResolvedSupplyFlowView {
  const evidence = resolveEvidenceRecords(fixture, flow.evidenceIds, flow.sourceIds);
  return Object.freeze({
    flow,
    from: resolveEndpoint(fixture, nodeById, flow.fromEntityId),
    to: resolveEndpoint(fixture, nodeById, flow.toEntityId),
    item: fixture.items.find((item) => item.id === flow.itemId) ?? null,
    processStage:
      fixture.processStages.find((stage) => stage.id === flow.processStageId) ?? null,
    datasetVersion: datasetVersionForId(fixture, flow.datasetVersionId),
    contentVersion: contentVersionForId(fixture, flow.contentVersionId),
    sources: uniqueSources([
      ...sourcesForIds(fixture, flow.sourceIds),
      ...evidence.map((record) => record.source)
    ]),
    evidence,
    evidenceLevel: evidenceLevelView(flow.evidenceLevel),
    valueDataStatus: flow.valueDataStatus,
    quantityDataStatus: flow.quantityDataStatus
  });
}

function resolveProductionActivity(
  fixture: ReadonlyProductFixture,
  activity: ReadonlyProductionActivity
): ResolvedProductionActivityView {
  const evidence = resolveEvidenceRecords(fixture, activity.evidenceIds, activity.sourceIds);
  const itemById = new Map(fixture.items.map((item) => [item.id, item]));
  return Object.freeze({
    activity,
    entity:
      fixture.entities.find((entity) => entity.id === activity.locationEntityId) ?? null,
    processStage:
      fixture.processStages.find((stage) => stage.id === activity.processStageId) ?? null,
    inputs: freezeArray(
      activity.inputItemIds
        .map((itemId) => itemById.get(itemId))
        .filter((item): item is ReadonlyItem => Boolean(item))
    ),
    outputs: freezeArray(
      activity.outputItemIds
        .map((itemId) => itemById.get(itemId))
        .filter((item): item is ReadonlyItem => Boolean(item))
    ),
    datasetVersion: datasetVersionForId(fixture, activity.datasetVersionId),
    contentVersion: contentVersionForId(fixture, activity.contentVersionId),
    sources: uniqueSources([
      ...sourcesForIds(fixture, activity.sourceIds),
      ...evidence.map((record) => record.source)
    ]),
    evidence,
    evidenceLevel: evidenceLevelView(activity.evidenceLevel)
  });
}

function resolveEvidenceGap(
  fixture: ReadonlyProductFixture,
  gap: ReadonlyEvidenceGap,
  nodeById: ReadonlyMap<string, ResolvedStoryNodeView>,
  flowById: ReadonlyMap<string, ResolvedSupplyFlowView>
): ResolvedEvidenceGapView {
  return Object.freeze({
    gap,
    node: gap.nodeId ? nodeById.get(gap.nodeId) ?? null : null,
    flow: gap.flowId ? flowById.get(gap.flowId) ?? null : null,
    evidence: resolveEvidenceRecords(fixture, gap.evidenceIds),
    datasetVersion: datasetVersionForId(fixture, gap.datasetVersionId),
    contentVersion: contentVersionForId(fixture, gap.contentVersionId)
  });
}

function resolveAllEvidenceGaps(
  fixture: ReadonlyProductFixture
): readonly ResolvedEvidenceGapView[] {
  const nodeById = new Map(
    fixture.storyGraph.nodes.map((node) => [node.id, resolveStoryNode(fixture, node)])
  );
  const flowById = new Map(
    fixture.storyGraph.flows.map((flow) => [
      flow.id,
      resolveSupplyFlow(fixture, nodeById, flow)
    ])
  );
  return freezeArray(
    fixture.evidenceGaps.map((gap) =>
      resolveEvidenceGap(fixture, gap, nodeById, flowById)
    )
  );
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
      if (!matchesPeriod(node.period ?? fixture.storyGraph.period, options)) return false;
      if (!focusItemIds && !processStageIds) return true;
      const itemMatches = !!node.itemId && !!focusItemIds?.has(node.itemId);
      const stageMatches =
        !processStageIds || (!!node.processStageId && processStageIds.has(node.processStageId));
      return (itemMatches && stageMatches) || selectedEndpointRefs.has(node.id);
    })
    .map((node) => allResolvedNodes.get(node.id) as ResolvedStoryNodeView);

  const selectedNodeIds = new Set(selectedNodes.map((node) => node.node.id));
  const resolvedFlows = selectedFlows.map((flow) =>
    resolveSupplyFlow(fixture, allResolvedNodes, flow)
  );
  const resolvedFlowById = new Map(resolvedFlows.map((flow) => [flow.flow.id, flow]));
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
    .sort((left, right) => left.order - right.order)
    .map((step): ResolvedStoryStepView => {
      const filteredStep = Object.freeze({
        ...step,
        nodeIds: freezeArray(step.nodeIds.filter((nodeId) => selectedNodeIds.has(nodeId))),
        flowIds: freezeArray(step.flowIds.filter((flowId) => selectedFlowIds.has(flowId)))
      });
      const nodes = freezeArray(
        filteredStep.nodeIds
          .map((nodeId) => allResolvedNodes.get(nodeId))
          .filter((node): node is ResolvedStoryNodeView => Boolean(node))
      );
      const flows = freezeArray(
        filteredStep.flowIds
          .map((flowId) => resolvedFlowById.get(flowId))
          .filter((flow): flow is ResolvedSupplyFlowView => Boolean(flow))
      );
      const evidence = resolveEvidenceRecords(fixture, filteredStep.evidenceIds);
      const sources = uniqueSources([
        ...evidence.map((record) => record.source),
        ...nodes.flatMap((node) => node.sources),
        ...flows.flatMap((flow) => flow.sources)
      ]);
      return Object.freeze({
        step: filteredStep,
        nodes,
        flows,
        sources,
        evidence,
        contentVersion: contentVersionForId(fixture, filteredStep.contentVersionId)
      });
    });
  const evidence = uniqueResolvedEvidence([
    ...selectedNodes.flatMap((node) => node.evidence),
    ...resolvedFlows.flatMap((flow) => flow.evidence),
    ...selectedSteps.flatMap((step) => step.evidence)
  ]);
  const sources = uniqueSources([
    ...selectedNodes.flatMap((node) => node.sources),
    ...resolvedFlows.flatMap((flow) => flow.sources),
    ...selectedSteps.flatMap((step) => step.sources),
    ...evidence.map((record) => record.source)
  ]);
  const selectedFlowById = new Map(resolvedFlows.map((flow) => [flow.flow.id, flow]));
  const evidenceGaps = fixture.evidenceGaps
    .filter(
      (gap) =>
        (gap.nodeId ? selectedNodeIds.has(gap.nodeId) : false) ||
        (gap.flowId ? selectedFlowIds.has(gap.flowId) : false)
    )
    .map((gap) => resolveEvidenceGap(fixture, gap, allResolvedNodes, selectedFlowById));

  const roleSupportedNodeCount = selectedNodes.filter(({ evidenceLevel }) => evidenceLevel.supportsCountryRole).length;
  const bilateralSupportedFlowCount = resolvedFlows.filter(({ evidenceLevel }) => evidenceLevel.supportsBilateralFlow).length;
  const representativeFlowCount = resolvedFlows.filter(({ evidenceLevel }) => evidenceLevel.isRepresentative).length;
  const unknownQuantityFlowCount = resolvedFlows.filter(({ quantityDataStatus }) => quantityDataStatus === "unknown").length;
  const interpretationMode: SupplyChainInterpretationSummary["mode"] = resolvedFlows.length > 0
    ? "route"
    : selectedNodes.length > 0
      ? "evidence_only"
      : "empty";
  const interpretationSummary = Object.freeze({
    mode: interpretationMode,
    title: interpretationMode === "route" ? "这张图目前能够说明什么？" : interpretationMode === "evidence_only" ? "当前只有组件或国家角色证据" : "当前没有已发布的路线证据",
    description: interpretationMode === "route"
      ? "国家产业角色、直接双边流向与代表性连接分别统计；一种证据不会自动升级成另一种主张。"
      : interpretationMode === "evidence_only"
        ? "你可以查看已有节点及其来源，但这些节点尚不能连接成一条有证据支持的国家间供应链。"
        : "该组件已登记，但当前版本没有可展示的节点或连接。",
    items: freezeArray([
      Object.freeze({ code: "country_roles" as const, label: "有来源支持的国家角色", count: roleSupportedNodeCount, description: "来源支持某国参与相关生产或市场环节，不代表它必然向下一国供货。", tone: "supported" as const }),
      Object.freeze({ code: "direct_bilateral_flows" as const, label: "直接支持的双边连接", count: bilateralSupportedFlowCount, description: "只有证据同时支持起点、终点、方向和期间时才计入。", tone: "direct" as const }),
      Object.freeze({ code: "representative_connections" as const, label: "代表性整理连接", count: representativeFlowCount, description: "用于帮助理解典型结构，不是某台手机的确定物流记录。", tone: "representative" as const }),
      Object.freeze({ code: "unknown_quantities" as const, label: "数量尚未提供的连接", count: unknownQuantityFlowCount, description: "未知数量保持未知，不会被显示或计算为 0。", tone: "unknown" as const })
    ])
  });

  return Object.freeze({
    product,
    period: fixture.storyGraph.period,
    nodes: freezeArray(selectedNodes),
    flows: freezeArray(resolvedFlows),
    steps: freezeArray(selectedSteps),
    datasetVersion: fixture.datasetVersion,
    route: createRouteProvenance(fixture),
    sources,
    evidence,
    evidenceGaps: freezeArray(evidenceGaps),
    interpretationSummary,
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
    // Keep the published manifest's order so product editors can put the
    // clearest, most useful entry point first across catalog and onboarding.
    .filter((product): product is ProductCatalogView => product !== null);

  return freezeArray(products);
}

export function listCountries(repository: FixtureRepository): readonly CountryCatalogView[] {
  const products = repository.listProductIds().map((productId) => repository.getProductFixture(productId)).filter((fixture): fixture is NonNullable<typeof fixture> => Boolean(fixture));
  const byEntity = new Map<string, CountryCatalogView>();
  products.forEach((fixture) => {
    fixture.entities.filter((entity) => entity.kind === "country").forEach((entity) => {
      const relatedNodeCount = fixture.storyGraph.nodes.filter((node) => node.entityId === entity.id).length;
      const roles = fixture.storyGraph.nodes.filter((node) => node.entityId === entity.id).map((node) => {
        const item = fixture.items.find((candidate) => candidate.id === node.itemId)?.name;
        const stage = fixture.processStages.find((candidate) => candidate.id === node.processStageId)?.label;
        return item && stage ? `${item} · ${stage}` : item ?? stage ?? node.label;
      });
      const current = byEntity.get(entity.id);
      const hasProductLedger = fixture.tradeObservations.some((observation) => observation.reporterEntityId === entity.id)
        || fixture.macroIndicators.some((observation) => observation.entityId === entity.id);
      const ledgerProductIds = freezeArray([
        ...(current?.ledgerProductIds ?? []),
        ...(hasProductLedger ? [fixture.productId] : [])
      ]);
      byEntity.set(entity.id, {
        entity,
        productIds: freezeArray([...(current?.productIds ?? []), fixture.productId]),
        ledgerProductIds,
        relatedNodeCount: (current?.relatedNodeCount ?? 0) + relatedNodeCount,
        hasTradeLedger: ledgerProductIds.length > 0,
        datasetVersion: fixture.datasetVersion,
        roles: freezeArray([...new Set([...(current?.roles ?? []), ...roles])])
      });
    });
  });
  return freezeArray([...byEntity.values()].sort((left, right) => left.entity.name.localeCompare(right.entity.name)));
}

export function listCategories(repository: FixtureRepository): readonly CategoryCatalogView[] {
  const products = repository.listProductIds().map((productId) => repository.getProductFixture(productId)).filter((fixture): fixture is NonNullable<typeof fixture> => Boolean(fixture));
  const categories = new Map<string, CategoryCatalogView>();
  products.forEach((fixture) => fixture.items.forEach((item) => {
    const current = categories.get(item.category);
    categories.set(item.category, {
      category: item.category,
      itemCount: (current?.itemCount ?? 0) + 1,
      productIds: freezeArray([...new Set([...(current?.productIds ?? []), fixture.productId])]),
      publishedItemCount: (current?.publishedItemCount ?? 0) + (item.dataStatus === "observed" ? 1 : 0)
    });
  }));
  return freezeArray([...categories.values()].sort((left, right) => left.category.localeCompare(right.category)));
}

export function getTradeNetwork(repository: FixtureRepository, productId: string, options?: TradeNetworkOptions): TradeNetworkView | null {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return null;
  const product = getProductItem(fixture);
  if (!product) return null;
  const observations = fixture.tradeObservations.filter((observation) =>
    observation.partnerScope === "entity" &&
    observation.partnerEntityId &&
    (!options?.itemId || observation.itemId === options.itemId) &&
    (!options?.countryEntityId || observation.reporterEntityId === options.countryEntityId || observation.partnerEntityId === options.countryEntityId) &&
    (!options?.direction || observation.direction === options.direction) &&
    matchesPeriod(observation.period, options)
  ).map((observation) => Object.freeze({
    observation,
    reporter: fixture.entities.find((entity) => entity.id === observation.reporterEntityId) ?? null,
    partner: fixture.entities.find((entity) => entity.id === observation.partnerEntityId) ?? null,
    item: observation.itemId ? fixture.items.find((item) => item.id === observation.itemId) ?? null : null,
    source: sourceForId(fixture, observation.sourceId),
    valueDataStatus: tradeValueDataStatus(observation),
    quantityDataStatus: tradeQuantityDataStatus(observation)
  }));
  const countries = [...new Map(observations.flatMap(({ reporter, partner }) => [reporter, partner]).filter((entity): entity is ReadonlyGeoEntity => Boolean(entity)).map((entity) => [entity.id, entity])).values()];
  return Object.freeze({ product, period: statisticsPeriod(observations.map((view) => view.observation), fixture.storyGraph.period), observations: freezeArray(observations), countries: freezeArray(countries), datasetVersion: fixture.datasetVersion, warnings: mergeWarnings(fixture.warnings, ["贸易网络只包含具体 partnerEntity 的观察；partnerCode=0 世界总计不会被画成双边流线。", "双边贸易观察证明统计分类、报告方、伙伴、方向和期间，不证明进入某部手机或连续供应链。"]) });
}

export function getTradeMapView(repository: FixtureRepository, productId: string, options?: TradeMapOptions): TradeMapView | null {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return null;
  const product = getProductItem(fixture);
  const selectedItem = fixture.items.find(item => item.id === (options?.focusItemId ?? productId));
  if (!product || !selectedItem) return null;
  const classification = (system: string, version: string, code: string, mappingType: string | null) => Object.freeze({
    system, version, code, mappingType,
    label: fixture.classificationCodes.find(candidate => candidate.system === system && candidate.version === version && candidate.code === code)?.label ?? null
  });
  const productRecords: TradeMapObservationView[] = fixture.tradeObservations.map(observation => {
    const code = fixture.classificationCodes.find(candidate => candidate.system === observation.classificationSystem && candidate.version === observation.classificationVersion && candidate.code === observation.classificationCode);
    const mapping = fixture.classificationCrosswalks.find(candidate => candidate.itemId === observation.itemId && candidate.classificationCodeId === code?.id && candidate.period.start <= observation.period.end && candidate.period.end >= observation.period.start);
    return Object.freeze({
    recordKind: "product_trade" as const, id: observation.id,
    item: fixture.items.find(item => item.id === observation.itemId) ?? null,
    reporter: fixture.entities.find(entity => entity.id === observation.reporterEntityId) ?? null,
    partner: fixture.entities.find(entity => entity.id === observation.partnerEntityId) ?? null,
    partnerScope: tradePartnerScope(observation), direction: observation.direction, period: observation.period,
    value: observation.value ?? null, currency: observation.currency ?? null, valueDataStatus: tradeValueDataStatus(observation),
    quantity: observation.quantity ?? null, unit: observation.unit ?? null, quantityDataStatus: tradeQuantityDataStatus(observation),
    classification: classification(observation.classificationSystem, observation.classificationVersion, observation.classificationCode, mapping?.mappingType ?? null),
    method: observation.method, source: sourceForId(fixture, observation.sourceId),
    datasetVersion: datasetVersionForId(fixture, observation.datasetVersionId), limitation: mapping?.limitation ?? null
    });
  });
  const materialRecords: TradeMapObservationView[] = fixture.materialTradeObservations.map(observation => Object.freeze({
    recordKind: "material_trade" as const, id: observation.observationId,
    item: fixture.items.find(item => item.id === observation.materialItemId) ?? null,
    reporter: fixture.entities.find(entity => entity.id === observation.reporterEntityId) ?? null,
    partner: fixture.entities.find(entity => entity.id === observation.partnerEntityId) ?? null,
    partnerScope: observation.partnerScope, direction: observation.flow, period: observation.period,
    value: observation.value, currency: observation.currency, valueDataStatus: observation.valueDataStatus,
    quantity: observation.quantity, unit: observation.unit ?? null, quantityDataStatus: observation.quantityDataStatus,
    classification: classification(observation.classificationSystem, observation.classificationVersion, observation.classificationCode, observation.classificationMappingType),
    method: observation.method, source: sourceForId(fixture, observation.sourceId),
    datasetVersion: datasetVersionForId(fixture, observation.datasetVersionId), limitation: observation.limitation
  }));
  const allRecords = [...productRecords, ...materialRecords];
  // The finished-product view remains the product's own statistics; a component includes its configured descendants.
  const selectedIds = selectedItem.id === productId ? new Set([productId]) : getDescendantItemIds(fixture, selectedItem.id);
  const relatedIds = new Set(allRecords.filter(record => record.item && selectedIds.has(record.item.id)).flatMap(record => record.item ? [record.item.id] : []));
  const observations = allRecords.filter(record => record.item && selectedIds.has(record.item.id) &&
    (!options?.countryEntityId || record.reporter?.id === options.countryEntityId || record.partner?.id === options.countryEntityId) &&
    (!options?.direction || record.direction === options.direction) && matchesPeriod(record.period, options));
  const itemCoverage = fixture.items.map(item => {
    const descendants = item.id === productId ? new Set([productId]) : getDescendantItemIds(fixture, item.id);
    return Object.freeze({ item,
      directObservationCount: allRecords.filter(record => record.item?.id === item.id).length,
      relatedObservationCount: allRecords.filter(record => record.item && descendants.has(record.item.id)).length
    });
  });
  return Object.freeze({ product, selectedItem, relatedItems: freezeArray(fixture.items.filter(item => relatedIds.has(item.id))),
    observations: freezeArray(observations), itemCoverage: freezeArray(itemCoverage), datasetVersion: fixture.datasetVersion });
}

export function getProductOverview(
  repository: FixtureRepository,
  productId: string
): ProductOverviewView | null {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return null;
  const product = getProductItem(fixture);
  if (!product) return null;

  const directChildren = fixture.items.filter((item) => item.parentItemId === product.id);
  const componentCoverage = directChildren.map((item) => {
    const story = createStoryView(fixture, { focusItemId: item.id });
    const nodeCount = story.nodes.length;
    const flowCount = story.flows.length;
    const evidenceLevels = [...new Set([
      ...story.nodes.map((node) => node.evidenceLevel.code),
      ...story.flows.map((flow) => flow.evidenceLevel.code)
    ])];
    const itemIds = new Set<string>([item.id]);
    let frontier = [item.id];
    while (frontier.length > 0) {
      const children = fixture.items.filter((candidate) => frontier.includes(candidate.parentItemId ?? ""));
      children.forEach((child) => itemIds.add(child.id));
      frontier = children.map((child) => child.id);
    }
    const classificationMappings = fixture.classificationCrosswalks
      .filter((mapping) => itemIds.has(mapping.itemId))
      .map((mapping) => {
        const classification = fixture.classificationCodes.find((code) => code.id === mapping.classificationCodeId);
        if (!classification) return null;
        return Object.freeze({
          classification,
          mappingType: mapping.mappingType,
          limitation: mapping.limitation ?? mapping.notes ?? "该分类不证明产品最终用途或指定供应链关系。",
          supportsEndUse: mapping.mappingType === "exact" && item.id === fixture.productId
        });
      })
      .filter((value): value is ComponentClassificationView => value !== null);
    const processChains = fixture.manufacturingProcessChains
      .filter((chain) => itemIds.has(chain.itemId) || fixture.manufacturingProcessSteps.some((step) => step.processChainId === chain.id && [...step.inputItemIds, ...step.outputItemIds].some((id) => itemIds.has(id))))
      .map((chain): ManufacturingProcessChainSummaryView => {
        const steps = fixture.manufacturingProcessSteps.filter((step) => step.processChainId === chain.id);
        const requirements = fixture.processRequirements.filter((requirement) => steps.some((step) => step.id === requirement.processStepId));
        const equipmentIds = new Set(requirements.flatMap((requirement) => requirement.equipmentCategoryId ? [requirement.equipmentCategoryId] : []));
        const manufacturerIds = new Set(fixture.organizationCapabilities.filter((capability) => equipmentIds.has(capability.equipmentCategoryId)).map((capability) => capability.organizationId));
        return Object.freeze({
          id: chain.id,
          title: chain.title,
          item: fixture.items.find((candidate) => candidate.id === chain.itemId) ?? null,
          stepCount: steps.length,
          equipmentCategoryCount: equipmentIds.size,
          manufacturerCount: manufacturerIds.size
        });
      });
    return Object.freeze({
      item,
      status: nodeCount > 0 && flowCount > 0 ? "route_published" : nodeCount > 0 || flowCount > 0 ? "partial_route" : "catalog_only",
      statusLabel: nodeCount > 0 && flowCount > 0 ? "已有代表性路线" : nodeCount > 0 || flowCount > 0 ? "已有部分证据" : "组件记录，路线待补",
      statusDescription: nodeCount > 0 && flowCount > 0
        ? "可沿节点和连接查看一条代表性路线。"
        : nodeCount > 0 || flowCount > 0
          ? "已有国家角色或组件证据，但尚未形成可验证的完整双边路线。"
          : "已登记该组件，尚未发布可查看的路线证据。",
      hasInspectableStory: nodeCount > 0 || flowCount > 0,
      nodeCount,
      flowCount,
      evidenceGapCount: story.evidenceGaps.length,
      evidenceLevels: freezeArray(evidenceLevels),
      classificationMappings: freezeArray(classificationMappings),
      processChains: freezeArray(processChains)
    });
  });

  return Object.freeze({
    product,
    directChildren: freezeArray(directChildren),
    componentCoverage: freezeArray(componentCoverage),
    statisticsPeriodLabel: statisticsPeriodLabel([...fixture.tradeObservations, ...fixture.materialTradeObservations, ...fixture.macroIndicators]),
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
  const productionActivities = fixture.productionActivities
    .filter((activity) => {
      if (!node.entity?.id || activity.locationEntityId !== node.entity.id) return false;
      if (node.processStage?.id && activity.processStageId !== node.processStage.id) return false;
      if (!node.item?.id) return true;
      return [...activity.inputItemIds, ...activity.outputItemIds].includes(node.item.id);
    })
    .map((activity) => resolveProductionActivity(fixture, activity));
  const evidence = uniqueResolvedEvidence([
    ...node.evidence,
    ...incomingFlows.flatMap((flow) => flow.evidence),
    ...outgoingFlows.flatMap((flow) => flow.evidence),
    ...productionActivities.flatMap((activity) => activity.evidence)
  ]);
  const sources = uniqueSources([
    ...node.sources,
    ...incomingFlows.flatMap((flow) => flow.sources),
    ...outgoingFlows.flatMap((flow) => flow.sources),
    ...productionActivities.flatMap((activity) => activity.sources),
    ...evidence.map((record) => record.source)
  ]);
  const storyNodeById = new Map(story.nodes.map((view) => [view.node.id, view]));
  const storyFlowById = new Map(story.flows.map((view) => [view.flow.id, view]));
  const evidenceGaps = fixture.evidenceGaps
    .filter(
      (gap) =>
        gap.nodeId === nodeId ||
        (gap.flowId ? incomingFlows.some((flow) => flow.flow.id === gap.flowId) : false) ||
        (gap.flowId ? outgoingFlows.some((flow) => flow.flow.id === gap.flowId) : false)
    )
    .map((gap) => resolveEvidenceGap(fixture, gap, storyNodeById, storyFlowById));

  return Object.freeze({
    node,
    incomingFlows: freezeArray(incomingFlows),
    outgoingFlows: freezeArray(outgoingFlows),
    productionActivities: freezeArray(productionActivities),
    datasetVersion: fixture.datasetVersion,
    sources,
    evidence,
    evidenceGaps: freezeArray(evidenceGaps),
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
    period: statisticsPeriod([...sortedTradeObservations, ...sortedMacroIndicators], fixture.storyGraph.period),
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
  const evidence = fixture.evidence.filter((record) => {
    if (evidenceIdSet) return evidenceIdSet.has(record.id);
    return !sourceIdSet || sourceIdSet.has(record.sourceId);
  });
  const evidenceSourceIds = new Set(evidence.map((record) => record.sourceId));
  const sources = fixture.sources.filter((source) => {
    if (sourceIdSet) return sourceIdSet.has(source.id);
    if (evidenceIdSet) return evidenceSourceIds.has(source.id);
    return true;
  });
  const resolvedEvidence = freezeArray(
    evidence.map((record) =>
      Object.freeze({ evidence: record, source: sourceForId(fixture, record.sourceId) })
    )
  );
  const indicatorDefinitions = fixture.indicatorDefinitions.filter(
    (definition) => !sourceIdSet || definition.sourceIds.some((sourceId) => sourceIdSet.has(sourceId))
  );
  const evidenceGaps = resolveAllEvidenceGaps(fixture).filter((view) =>
    view.evidence.every((record) => {
      if (evidenceIdSet) return evidenceIdSet.has(record.evidence.id);
      return !sourceIdSet || (record.source ? sourceIdSet.has(record.source.id) : false);
    })
  );

  return Object.freeze({
    datasetVersion: fixture.datasetVersion,
    contentVersions: freezeArray(fixture.contentVersions),
    sources: freezeArray(sources),
    evidence: freezeArray(evidence),
    resolvedEvidence,
    evidenceGaps: freezeArray(evidenceGaps),
    route: createRouteProvenance(fixture),
    indicatorDefinitions: freezeArray(indicatorDefinitions),
    missingDataNotes: freezeArray(fixture.missingDataNotes),
    warnings: mergeWarnings(fixture.warnings, fixture.storyGraph.warnings)
  });
}

export function getEvidenceGaps(
  repository: FixtureRepository,
  productId: string
): readonly ResolvedEvidenceGapView[] {
  const fixture = getFixtureOrNull(repository, productId);
  return fixture ? resolveAllEvidenceGaps(fixture) : freezeArray([]);
}

export function getMaterialTradeObservations(repository: FixtureRepository, productId: string, options?: MaterialTradeObservationOptions): readonly MaterialTradeObservationView[] {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return freezeArray([]);
  const gaps = resolveAllEvidenceGaps(fixture);
  return freezeArray((fixture.materialTradeObservations ?? []).filter((observation) =>
    (!options?.materialItemId || observation.materialItemId === options.materialItemId) &&
    (!options?.reporterEntityId || observation.reporterEntityId === options.reporterEntityId) &&
    (!options?.partnerScope || observation.partnerScope === options.partnerScope) &&
    (!options?.flow || observation.flow === options.flow) &&
    (!options?.classificationMappingType || observation.classificationMappingType === options.classificationMappingType) &&
    matchesPeriod(observation.period, options)
  ).map((observation) => Object.freeze({
    observation,
    reporter: fixture.entities.find((entity) => entity.id === observation.reporterEntityId) ?? null,
    partner: observation.partnerEntityId ? fixture.entities.find((entity) => entity.id === observation.partnerEntityId) ?? null : null,
    item: fixture.items.find((item) => item.id === observation.materialItemId) ?? null,
    source: sourceForId(fixture, observation.sourceId),
    partnerScope: observation.partnerScope,
    evidenceLevel: evidenceLevelView(observation.evidenceLevel),
    relatedEvidenceGaps: freezeArray(gaps.filter(({ gap, node, flow }) =>
      node?.item?.id === observation.materialItemId ||
      flow?.item?.id === observation.materialItemId ||
      gap.classificationCandidates.some((candidate) => candidate.system === observation.classificationSystem && candidate.version === observation.classificationVersion && candidate.code === observation.classificationCode)
    ))
  })).sort((left, right) => left.observation.materialItemId.localeCompare(right.observation.materialItemId) || left.observation.partnerCode - right.observation.partnerCode || left.observation.flow.localeCompare(right.observation.flow)));
}

export function getMaterialTradeObservation(repository: FixtureRepository, productId: string, observationId: string): MaterialTradeObservationView | null {
  return getMaterialTradeObservations(repository, productId).find((view) => view.observation.observationId === observationId) ?? null;
}

export function getTradeGuides(
  repository: FixtureRepository,
  productId: string,
  options?: TradeGuideOptions
): readonly TradeGuideView[] {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return freezeArray([]);
  const guides = (fixture.tradeGuides ?? [])
    .filter((guide) =>
      (!options?.jurisdictionEntityId || guide.scope.jurisdictionEntityId === options.jurisdictionEntityId) &&
      (!options?.direction || guide.scope.direction === options.direction) &&
      (!options?.itemId || guide.scope.itemId === options.itemId) &&
      matchesPeriod(guide.period, options)
    )
    .sort((left, right) =>
      left.scope.jurisdictionEntityId.localeCompare(right.scope.jurisdictionEntityId) ||
      left.scope.direction.localeCompare(right.scope.direction) ||
      left.title.localeCompare(right.title)
    )
    .map((guide) => resolveTradeGuideView(fixture, guide));
  return freezeArray(guides);
}

export function getTradeGuide(
  repository: FixtureRepository,
  productId: string,
  guideId: string
): TradeGuideView | null {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return null;
  const guide = (fixture.tradeGuides ?? []).find((candidate) => candidate.id === guideId);
  return guide ? resolveTradeGuideView(fixture, guide) : null;
}

export function getManufacturingProcessChain(
  repository: FixtureRepository,
  productId: string,
  processChainId: string
): ManufacturingProcessChainView | null {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return null;
  const product = getProductItem(fixture);
  const chain = fixture.manufacturingProcessChains.find((candidate) => candidate.id === processChainId);
  if (!product || !chain) return null;

  const resolveCapability = (capability: ReadonlyOrganizationCapability): ResolvedOrganizationCapabilityView => {
    const organization = fixture.organizations.find((candidate) => candidate.id === capability.organizationId) ?? null;
    const evidence = resolveEvidenceRecords(fixture, capability.evidenceIds, capability.sourceIds);
    return Object.freeze({
      capability,
      organization,
      headquarters: organization?.headquartersEntityId ? fixture.entities.find((entity) => entity.id === organization.headquartersEntityId) ?? null : null,
      equipmentCategory: fixture.equipmentCategories.find((equipment) => equipment.id === capability.equipmentCategoryId) ?? null,
      sources: uniqueSources([...sourcesForIds(fixture, capability.sourceIds), ...evidence.map((record) => record.source)]),
      evidence,
      relationshipLabel: capability.commercialRelationshipClaimed ? "公开披露的供货关系" : "厂商设备能力",
      relationshipDescription: capability.commercialRelationshipClaimed
        ? "来源明确披露该厂商与指定客户之间的商业关系。"
        : "来源只支持该企业提供此类设备，不证明它向路线中的任何指定客户或工厂供货。"
    });
  };

  const steps = fixture.manufacturingProcessSteps
    .filter((step) => step.processChainId === chain.id)
    .sort((left, right) => left.order - right.order)
    .map((step): ResolvedManufacturingProcessStepView => {
      const stepEvidence = resolveEvidenceRecords(fixture, step.evidenceIds, step.sourceIds);
      const requirements = fixture.processRequirements
        .filter((requirement) => requirement.processStepId === step.id)
        .map((requirement): ResolvedProcessRequirementView => {
          const evidence = resolveEvidenceRecords(fixture, requirement.evidenceIds, requirement.sourceIds);
          const capabilities = requirement.equipmentCategoryId
            ? fixture.organizationCapabilities.filter((capability) => capability.equipmentCategoryId === requirement.equipmentCategoryId).map(resolveCapability)
            : [];
          return Object.freeze({
            requirement,
            equipmentCategory: requirement.equipmentCategoryId ? fixture.equipmentCategories.find((equipment) => equipment.id === requirement.equipmentCategoryId) ?? null : null,
            item: requirement.itemId ? fixture.items.find((item) => item.id === requirement.itemId) ?? null : null,
            capabilities: freezeArray(capabilities),
            sources: uniqueSources([...sourcesForIds(fixture, requirement.sourceIds), ...evidence.map((record) => record.source), ...capabilities.flatMap((capability) => capability.sources)]),
            evidence
          });
        });
      return Object.freeze({
        step,
        inputItems: freezeArray(step.inputItemIds.map((itemId) => fixture.items.find((item) => item.id === itemId)).filter((item): item is ReadonlyItem => Boolean(item))),
        outputItems: freezeArray(step.outputItemIds.map((itemId) => fixture.items.find((item) => item.id === itemId)).filter((item): item is ReadonlyItem => Boolean(item))),
        datasetVersion: datasetVersionForId(fixture, step.datasetVersionId),
        contentVersion: contentVersionForId(fixture, step.contentVersionId),
        routeVariants: freezeArray(fixture.manufacturingRouteVariants.filter((variant) => step.routeVariantIds.includes(variant.id))),
        requirements: freezeArray(requirements),
        sources: uniqueSources([...sourcesForIds(fixture, step.sourceIds), ...stepEvidence.map((record) => record.source), ...requirements.flatMap((requirement) => requirement.sources)]),
        evidence: stepEvidence
      });
    });
  const evidence = uniqueResolvedEvidence([
    ...resolveEvidenceRecords(fixture, chain.evidenceIds, chain.sourceIds),
    ...steps.flatMap((step) => step.evidence),
    ...steps.flatMap((step) => step.requirements.flatMap((requirement) => requirement.capabilities.flatMap((capability) => capability.evidence)))
  ]);
  const sources = uniqueSources([...sourcesForIds(fixture, chain.sourceIds), ...steps.flatMap((step) => step.sources), ...evidence.map((record) => record.source)]);
  const organizations = [...new Map(steps.flatMap((step) => step.requirements.flatMap((requirement) => requirement.capabilities.map((capability) => capability.organization))).filter((organization): organization is ReadonlyOrganization => Boolean(organization)).map((organization) => [organization.id, organization])).values()];
  let componentItem = fixture.items.find((candidate) => candidate.id === chain.itemId) ?? null;
  while (componentItem?.parentItemId && componentItem.parentItemId !== fixture.productId) {
    const parent = fixture.items.find((candidate) => candidate.id === componentItem?.parentItemId);
    if (!parent || parent.id === componentItem.id) break;
    componentItem = parent;
  }

  return Object.freeze({
    product,
    chain,
    item: fixture.items.find((candidate) => candidate.id === chain.itemId) ?? null,
    componentItem,
    steps: freezeArray(steps),
    routeVariants: freezeArray(fixture.manufacturingRouteVariants.filter((variant) => variant.processChainId === chain.id)),
    organizations: freezeArray(organizations),
    sources,
    evidence,
    datasetVersion: fixture.datasetVersion,
    contentVersion: contentVersionForId(fixture, chain.contentVersionId),
    warnings: mergeWarnings(fixture.warnings, chain.limitations, ["厂商能力资料与具体客户供货记录分别整理，可在来源详情中查看适用范围。"])
  });
}

export function getProductResearchExport(
  repository: FixtureRepository,
  productId: string
): ProductResearchExportView | null {
  const fixture = getFixtureOrNull(repository, productId);
  if (!fixture) return null;

  return Object.freeze({
    formatVersion: "product-research-export.v1",
    productId,
    release: Object.freeze({
      datasetVersion: fixture.datasetVersion,
      contentVersions: freezeArray(fixture.contentVersions),
      period: fixture.storyGraph.period
    }),
    includedModules: Object.freeze([
      "catalog",
      "supply_chain",
      "trade_ledger",
      "trade_guidance",
      "material_trade",
      "manufacturing_process",
      "provenance",
      "evidence_gaps"
    ] as const),
    recordCounts: Object.freeze({
      entities: fixture.entities.length,
      items: fixture.items.length,
      storyNodes: fixture.storyGraph.nodes.length,
      storyFlows: fixture.storyGraph.flows.length,
      tradeObservations: fixture.tradeObservations.length,
      tradeGuides: fixture.tradeGuides.length,
      tariffMeasures: fixture.tariffMeasures.length,
      tradeRequirements: fixture.tradeRequirements.length,
      tradeProcedures: fixture.tradeProcedures.length,
      tradeProcedureSteps: fixture.tradeProcedureSteps.length,
      tradeDocumentRequirements: fixture.tradeDocumentRequirements.length,
      policyDocuments: fixture.policyDocuments.length,
      materialTradeObservations: fixture.materialTradeObservations.length,
      macroIndicators: fixture.macroIndicators.length,
      sources: fixture.sources.length,
      evidence: fixture.evidence.length,
      evidenceGaps: fixture.evidenceGaps.length
      ,manufacturingProcessChains: fixture.manufacturingProcessChains.length
      ,manufacturingProcessSteps: fixture.manufacturingProcessSteps.length
      ,equipmentCategories: fixture.equipmentCategories.length
      ,organizations: fixture.organizations.length
      ,organizationCapabilities: fixture.organizationCapabilities.length
    }),
    interpretationRules: freezeArray([
      Object.freeze({
        code: "representative_is_not_unique",
        statement: "代表性供应链连接不等于某件具体商品的唯一、完整或已观测路线。"
      }),
      Object.freeze({
        code: "customs_trade_is_not_end_use",
        statement: "海关分类商品贸易不自动证明该商品进入当前产品、指定工厂或连续物料谱系。"
      }),
      Object.freeze({
        code: "trade_value_is_not_profit",
        statement: "贸易金额不等于企业利润、成本、国内增加值或单件商品价格。"
      }),
      Object.freeze({
        code: "unknown_is_not_zero",
        statement: "unknown、withheld、estimated 与来源明确报告的真实零值必须分别解释。"
      }),
      Object.freeze({
        code: "versions_are_independent",
        statement: "统计数据集版本与策展内容版本独立演进，使用时必须同时保留。"
      }),
      Object.freeze({
        code: "manufacturer_capability_is_not_supply_relationship",
        statement: "企业公开提供某类设备不等于该企业向指定客户、工厂、芯片或商品路线实际供货。"
      })
    ]),
    snapshot: fixture
  });
}

export function createProductQueryService(
  repository: FixtureRepository
): ProductQueryService {
  return Object.freeze({
    listProducts: () => listProducts(repository),
    listCountries: () => listCountries(repository),
    listCategories: () => listCategories(repository),
    getTradeNetwork: (productId: string, options?: TradeNetworkOptions) => getTradeNetwork(repository, productId, options),
    getTradeMapView: (productId: string, options?: TradeMapOptions) => getTradeMapView(repository, productId, options),
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
      getProvenance(repository, productId, options),
    getProductResearchExport: (productId: string) =>
      getProductResearchExport(repository, productId),
    getEvidenceGaps: (productId: string) => getEvidenceGaps(repository, productId),
    getMaterialTradeObservations: (productId: string, options?: MaterialTradeObservationOptions) => getMaterialTradeObservations(repository, productId, options),
    getMaterialTradeObservation: (productId: string, observationId: string) => getMaterialTradeObservation(repository, productId, observationId),
    getTradeGuides: (productId: string, options?: TradeGuideOptions) => getTradeGuides(repository, productId, options),
    getTradeGuide: (productId: string, guideId: string) => getTradeGuide(repository, productId, guideId)
    ,getManufacturingProcessChain: (productId: string, processChainId: string) => getManufacturingProcessChain(repository, productId, processChainId)
  });
}
