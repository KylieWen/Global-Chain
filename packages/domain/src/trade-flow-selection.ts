import type {
  GeoEntity,
  DatasetVersion,
  Item
} from "@globe-chain/contracts";
import type {
  DeepReadonly,
  FixtureRepository,
  ReadonlyProductFixture
} from "./repository";
import {
  getTradeMapView,
  type TradeMapObservationView
} from "./queries";

type ReadonlyItem = DeepReadonly<Item>;
type ReadonlyGeoEntity = DeepReadonly<GeoEntity>;
type ReadonlyDatasetVersion = DeepReadonly<DatasetVersion>;

export interface TradeFlowSelectionOptions {
  readonly itemIds: readonly string[];
  readonly year: string;
  readonly currency: string;
}

export interface TradeFlowRecord {
  readonly observation: TradeMapObservationView;
  readonly sourceEntity: ReadonlyGeoEntity | null;
  readonly destinationEntity: ReadonlyGeoEntity | null;
  readonly item: ReadonlyItem;
  readonly isPreferredRecord: boolean;
  readonly alternativeRecordId: string | null;
  readonly notSummable: boolean;
}

export interface ClassificationOverlapWarning {
  readonly parentCode: string;
  readonly childCode: string;
  readonly affectedItemIds: readonly string[];
}

export interface TradeFlowSelectionView {
  readonly year: string;
  readonly currency: string;
  readonly flows: readonly TradeFlowRecord[];
  readonly worldTotals: readonly TradeFlowRecord[];
  readonly warnings: readonly string[];
  readonly datasetVersion: ReadonlyDatasetVersion;
  readonly classificationOverlaps: readonly ClassificationOverlapWarning[];
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function freezeRecord(record: TradeFlowRecord): TradeFlowRecord {
  return Object.freeze(record);
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

function computeMinimalCoveringSet(
  fixture: ReadonlyProductFixture,
  itemIds: readonly string[]
): readonly string[] {
  const unique = [...new Set(itemIds)];
  const existingIds = new Set(fixture.items.map(item => item.id));
  const validIds = unique.filter(id => existingIds.has(id));
  if (validIds.length <= 1) return freezeArray(validIds);

  const descendantSets = new Map<string, Set<string>>();
  for (const itemId of validIds) {
    descendantSets.set(
      itemId,
      itemId === fixture.productId
        ? new Set([itemId])
        : getDescendantItemIds(fixture, itemId)
    );
  }

  const covering = validIds.filter(itemId => {
    const descendants = descendantSets.get(itemId);
    if (!descendants) return false;
    return !validIds.some(otherId => {
      if (otherId === itemId) return false;
      const otherDescendants = descendantSets.get(otherId);
      if (!otherDescendants) return false;
      return otherDescendants.has(itemId);
    });
  });

  return freezeArray(covering);
}

function isClassificationPrefix(parentCode: string, childCode: string): boolean {
  return childCode.length > parentCode.length && childCode.startsWith(parentCode);
}

function mirrorGroupKey(
  system: string,
  version: string,
  classificationCode: string,
  year: string,
  sourceId: string,
  destinationId: string
): string {
  return JSON.stringify([system, version, classificationCode, year, sourceId, destinationId]);
}

interface NormalizedBilateral {
  readonly observation: TradeMapObservationView;
  readonly item: ReadonlyItem;
  readonly sourceEntity: ReadonlyGeoEntity | null;
  readonly destinationEntity: ReadonlyGeoEntity | null;
}

function normalizeDirection(
  observation: TradeMapObservationView,
  item: ReadonlyItem
): NormalizedBilateral {
  if (observation.direction === "export") {
    return {
      observation,
      item,
      sourceEntity: observation.reporter,
      destinationEntity: observation.partner
    };
  }
  return {
    observation,
    item,
    sourceEntity: observation.partner,
    destinationEntity: observation.reporter
  };
}

export function selectTradeFlows(
  repository: FixtureRepository,
  productId: string,
  options: TradeFlowSelectionOptions
): TradeFlowSelectionView | null {
  const fixture = repository.getProductFixture(productId);
  if (!fixture) return null;

  const { itemIds, year, currency } = options;
  if (!itemIds || itemIds.length === 0) return null;

  const coveringSet = computeMinimalCoveringSet(fixture, itemIds);
  if (coveringSet.length === 0) return null;

  const observationById = new Map<
    string,
    { observation: TradeMapObservationView; item: ReadonlyItem }
  >();

  for (const focusItemId of coveringSet) {
    const view = getTradeMapView(repository, productId, { focusItemId });
    if (!view) continue;
    for (const obs of view.observations) {
      const recordId = `${obs.recordKind}:${obs.id}`;
      if (observationById.has(recordId)) continue;
      const item: ReadonlyItem = obs.item ?? view.selectedItem;
      observationById.set(recordId, { observation: obs, item });
    }
  }

  const filtered: { observation: TradeMapObservationView; item: ReadonlyItem }[] = [];
  for (const entry of observationById.values()) {
    if (entry.observation.period.granularity !== "annual" ||
        entry.observation.period.start !== `${year}-01-01` ||
        entry.observation.period.end !== `${year}-12-31`) continue;
    if (entry.observation.currency !== currency) continue;
    filtered.push(entry);
  }

  const worldTotals: TradeFlowRecord[] = [];
  const bilateralNormals: NormalizedBilateral[] = [];

  for (const { observation, item } of filtered) {
    if (observation.partnerScope === "world_total") {
      worldTotals.push(freezeRecord({
        observation,
        sourceEntity: null,
        destinationEntity: null,
        item,
        isPreferredRecord: true,
        alternativeRecordId: null,
        notSummable: false
      }));
    } else if (observation.partnerScope === "entity" && observation.reporter && observation.partner && observation.reporter.id !== observation.partner.id) {
      bilateralNormals.push(normalizeDirection(observation, item));
    }
  }

  const mirrorGroups = new Map<string, NormalizedBilateral[]>();
  for (const record of bilateralNormals) {
    const key = mirrorGroupKey(
      record.observation.classification.system,
      record.observation.classification.version,
      record.observation.classification.code,
      year,
      record.sourceEntity?.id ?? "",
      record.destinationEntity?.id ?? ""
    );
    const group = mirrorGroups.get(key);
    if (group) {
      group.push(record);
    } else {
      mirrorGroups.set(key, [record]);
    }
  }

  const flows: TradeFlowRecord[] = [];
  for (const group of mirrorGroups.values()) {
    if (group.length === 1) {
      const record = group[0];
      flows.push(freezeRecord({
        observation: record.observation,
        sourceEntity: record.sourceEntity,
        destinationEntity: record.destinationEntity,
        item: record.item,
        isPreferredRecord: true,
        alternativeRecordId: null,
        notSummable: false
      }));
      continue;
    }

    const exportRecords = group.filter(r => r.observation.direction === "export");
    const importRecords = group.filter(r => r.observation.direction === "import");
    const ranked = [...exportRecords, ...importRecords].sort((a, b) => {
      const usable = (r: NormalizedBilateral) => r.observation.value !== null && ["observed", "estimated"].includes(r.observation.valueDataStatus);
      return Number(usable(b)) - Number(usable(a)) ||
        Number(b.observation.direction === "export") - Number(a.observation.direction === "export") ||
        a.observation.id.localeCompare(b.observation.id);
    });
    const preferred = ranked.slice(0, 1);
    const alternative = ranked.slice(1);
    const preferredId = preferred.length > 0 ? preferred[0].observation.id : null;
    const alternativeId = alternative.length > 0 ? alternative[0].observation.id : null;

    for (const record of preferred) {
      flows.push(freezeRecord({
        observation: record.observation,
        sourceEntity: record.sourceEntity,
        destinationEntity: record.destinationEntity,
        item: record.item,
        isPreferredRecord: true,
        alternativeRecordId: alternativeId,
        notSummable: false
      }));
    }
    for (const record of alternative) {
      flows.push(freezeRecord({
        observation: record.observation,
        sourceEntity: record.sourceEntity,
        destinationEntity: record.destinationEntity,
        item: record.item,
        isPreferredRecord: false,
        alternativeRecordId: preferredId,
        notSummable: true
      }));
    }
  }

  const allCodes = new Set<string>();
  const qualifiedCode = (flow: TradeFlowRecord) => JSON.stringify([flow.observation.classification.system, flow.observation.classification.version, flow.observation.classification.code]);
  for (const flow of flows) allCodes.add(qualifiedCode(flow));
  for (const wt of worldTotals) allCodes.add(qualifiedCode(wt));
  const codeArray = [...allCodes];

  const classificationOverlaps: ClassificationOverlapWarning[] = [];
  const overlappingCodes = new Set<string>();

  for (let i = 0; i < codeArray.length; i++) {
    for (let j = i + 1; j < codeArray.length; j++) {
      const [systemA, versionA, codeA] = JSON.parse(codeArray[i]) as string[];
      const [systemB, versionB, codeB] = JSON.parse(codeArray[j]) as string[];
      if (systemA !== systemB || versionA !== versionB) continue;
      if (!isClassificationPrefix(codeA, codeB) && !isClassificationPrefix(codeB, codeA)) {
        continue;
      }
      const parentCode = codeA.length <= codeB.length ? codeA : codeB;
      const childCode = codeA.length <= codeB.length ? codeB : codeA;
      overlappingCodes.add(codeArray[i]);
      overlappingCodes.add(codeArray[j]);

      const affectedItemIds = freezeArray([...new Set(
        [...flows, ...worldTotals]
          .filter(
            f =>
              qualifiedCode(f) === codeArray[i] ||
              qualifiedCode(f) === codeArray[j]
          )
          .map(f => f.item.id)
      )]);

      classificationOverlaps.push(Object.freeze({
        parentCode,
        childCode,
        affectedItemIds
      }));
    }
  }

  const finalFlows = freezeArray(
    flows.map(flow =>
      overlappingCodes.has(qualifiedCode(flow))
        ? freezeRecord({ ...flow, notSummable: true })
        : flow
    )
  );
  const finalWorldTotals = freezeArray(
    worldTotals.map(flow =>
      overlappingCodes.has(qualifiedCode(flow))
        ? freezeRecord({ ...flow, notSummable: true })
        : flow
    )
  );

  const warnings: string[] = [];
  if (classificationOverlaps.length > 0) {
    warnings.push("所选物品存在HS父子分类重叠，对应记录标记为不可直接相加。");
  }
  const hasMirrorAlternative = flows.some(f => !f.isPreferredRecord);
  if (hasMirrorAlternative) {
    warnings.push("同一HS分类、同向国家对存在镜像报告；优先保留出口方报告，替代记录不合计。");
  }

  return Object.freeze({
    year,
    currency,
    flows: finalFlows,
    worldTotals: finalWorldTotals,
    warnings: freezeArray(warnings),
    datasetVersion: fixture.datasetVersion,
    classificationOverlaps: freezeArray(classificationOverlaps)
  });
}
