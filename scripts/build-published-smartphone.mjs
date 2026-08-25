#!/usr/bin/env node

/**
 * Build the first published smartphone fixture from reviewed raw snapshots.
 *
 * This script is intentionally a local, deterministic transformation. It
 * never calls a remote API; run fetch-published-sources.mjs first when a new
 * source batch is intentionally being prepared. The sample fixture supplies
 * only the current generic catalog shape; reviewed route topology and evidence
 * bindings come from content/routes, while numeric observations are read from
 * data/published/raw.
 */

import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE_PATH = resolve(ROOT, "data/samples/smartphone/fixture.json");
const ROUTE_CONTENT_PATH = resolve(ROOT, "content/routes/generic-smartphone-2023.json");
const INDUSTRY_ROLE_EVIDENCE_PATH = resolve(ROOT, "content/evidence/industry-roles-2023.json");
const EVIDENCE_GAP_REGISTRY_PATH = resolve(
  ROOT,
  "content/evidence-gaps/generic-smartphone-2023.json"
);
const RAW_DIR = resolve(ROOT, "data/published/raw");
const BILATERAL_SNAPSHOT_PATH = resolve(
  RAW_DIR,
  "un-comtrade-hs2022-851713-bilateral-2023.json"
);
const MATERIAL_SNAPSHOT_PATH = resolve(RAW_DIR, "un-comtrade-hs2022-materials-2023.json");
const OUTPUT_DIR = resolve(ROOT, "data/published/smartphone");
const OUTPUT_PATH = resolve(OUTPUT_DIR, "fixture.json");
const MANIFEST_PATH = resolve(ROOT, "data/published/manifest.json");

const YEAR = "2023";
const PERIOD = {
  granularity: "annual",
  start: `${YEAR}-01-01`,
  end: `${YEAR}-12-31`,
  label: YEAR
};
const DATASET_ID = "dataset-smartphone-published-2023";
const DATASET_VERSION = "globe-chain-smartphone-2023.3";
const CONTENT_VERSION_ID = "content-smartphone-route-2023-2";
const SOURCE_IDS = {
  wdi: "source-world-bank-wdi",
  comtrade: "source-un-comtrade",
  m49: "source-un-m49",
  usgs: "source-usgs-mineral-commodities",
  iea: "source-iea-battery-supply-chain",
  routeMethod: "source-globe-chain-route-methodology"
};

const entityByComtradeCode = new Map([
  [156, "country-cn"],
  [276, "country-de"],
  // 842 is the source-native USA statistical area (including Puerto Rico and
  // the US Virgin Islands), not ISO/M49 840. The quality note retains that
  // wider source scope when linking it to the current country dimension.
  [842, "country-us"]
]);

// Published presentation metadata lives with the dataset build, rather than
// in the Web layer. Adding another macro indicator only requires another
// configuration entry and its observations.
const INDICATOR_CONFIG = [
  {
    indicator: "merchandise_exports_current_usd",
    label: "商品出口总额",
    shortLabel: "商品出口",
    description: "一国在该统计期间报告的商品出口总额，按当前美元计价。",
    category: "商品贸易",
    displayOrder: 10,
    displayUnit: "current USD",
    displayCurrency: "USD",
    valueMeaning: "海关/商品贸易统计金额，不是企业收入、成本或利润。",
    sourceIndicatorCode: "TX.VAL.MRCH.CD.WT",
    statisticalConcept: "customs",
    formula: null,
    method: "official"
  },
  {
    indicator: "merchandise_imports_current_usd",
    label: "商品进口总额",
    shortLabel: "商品进口",
    description: "一国在该统计期间报告的商品进口总额，按当前美元计价。",
    category: "商品贸易",
    displayOrder: 20,
    displayUnit: "current USD",
    displayCurrency: "USD",
    valueMeaning: "海关/商品贸易统计金额，不是企业收入、成本或利润。",
    sourceIndicatorCode: "TM.VAL.MRCH.CD.WT",
    statisticalConcept: "customs",
    formula: null,
    method: "official"
  },
  {
    indicator: "merchandise_trade_balance_current_usd",
    label: "商品贸易差额",
    shortLabel: "贸易差额",
    description: "同一 WDI 快照中商品出口总额减商品进口总额的确定性派生值。",
    category: "商品贸易",
    displayOrder: 30,
    displayUnit: "current USD",
    displayCurrency: "USD",
    valueMeaning: "正值表示顺差，负值表示逆差；不表示企业利润或国内增加值。",
    sourceIndicatorCode: "TX.VAL.MRCH.CD.WT; TM.VAL.MRCH.CD.WT",
    statisticalConcept: "customs",
    formula: "商品贸易差额 = 商品出口总额 - 商品进口总额",
    method: "derived"
  },
  {
    indicator: "official_reserves_including_gold_current_usd",
    label: "官方储备总额（含黄金）",
    shortLabel: "官方储备（含黄金）",
    description: "World Bank WDI 的 Total reserves (includes gold, current US$)。",
    category: "官方储备",
    displayOrder: 40,
    displayUnit: "current USD",
    displayCurrency: "USD",
    valueMeaning: "该指标含黄金，不等同于狭义的不含黄金外汇储备。",
    sourceIndicatorCode: "FI.RES.TOTL.CD",
    statisticalConcept: "official_reserve",
    formula: null,
    method: "official"
  }
];

const countryByIso3 = new Map([
  ["AUS", { id: "country-au", name: "澳大利亚", iso2: "AU", iso3: "AUS", m49: "036" }],
  ["COD", { id: "country-cd", name: "刚果民主共和国", iso2: "CD", iso3: "COD", m49: "180" }],
  ["CHL", { id: "country-cl", name: "智利", iso2: "CL", iso3: "CHL", m49: "152" }],
  ["CHN", { id: "country-cn", name: "中国", iso2: "CN", iso3: "CHN", m49: "156" }],
  ["DEU", { id: "country-de", name: "德国", iso2: "DE", iso3: "DEU", m49: "276" }],
  ["IDN", { id: "country-id", name: "印度尼西亚", iso2: "ID", iso3: "IDN", m49: "360" }],
  ["JPN", { id: "country-jp", name: "日本", iso2: "JP", iso3: "JPN", m49: "392" }],
  ["KOR", { id: "country-kr", name: "韩国", iso2: "KR", iso3: "KOR", m49: "410" }],
  // UN Comtrade reporterCode is 842 for the United States; do not confuse it
  // with the UN M49 country code (840) retained for dimension metadata.
  ["USA", { id: "country-us", name: "美国", iso2: "US", iso3: "USA", m49: "840", reporterCode: 842 }]
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function period() {
  return { ...PERIOD };
}

function buildIndicatorDefinitions() {
  return INDICATOR_CONFIG.map((definition) => ({
    id: `indicator-definition-${definition.indicator}`,
    ...definition,
    period: period(),
    sourceIds: [SOURCE_IDS.wdi],
    dataStatus: "observed",
    datasetVersionId: DATASET_ID
  }));
}

function sourceDefinition(raw, id, definition, sourceDatasetVersion = DATASET_VERSION) {
  const retrievedAt = raw.fetchedAt ?? "2026-08-25T00:00:00.000Z";
  return {
    id,
    ...definition,
    retrievedAt,
    datasetVersion: sourceDatasetVersion
  };
}

function parseWdiRows(raw) {
  const result = new Map();
  for (const [indicator, record] of Object.entries(raw.indicators ?? {})) {
    const rows = record.payload?.[1] ?? [];
    const byIso3 = new Map();
    for (const row of rows) {
      if (row?.countryiso3code) byIso3.set(row.countryiso3code, row);
    }
    result.set(indicator, byIso3);
  }
  return result;
}

function parseComtradeRows(raw) {
  return raw.payload?.data ?? [];
}

function makeMacroObservation({
  id,
  entityId,
  indicator,
  value,
  method,
  sourceId,
  statisticalConcept,
  notes
}) {
  const hasValue = typeof value === "number" && Number.isFinite(value);
  return {
    id,
    entityId,
    indicator,
    period: period(),
    value: hasValue ? value : null,
    quantity: null,
    currency: "USD",
    unit: "current USD",
    statisticalConcept,
    sourceId,
    datasetVersionId: DATASET_ID,
    method,
    dataStatus: hasValue ? "observed" : "unknown",
    notes: notes ?? null
  };
}

function buildMacroIndicators(wdiRaw) {
  const rowsByIndicator = parseWdiRows(wdiRaw);
  const exportsRows = rowsByIndicator.get("merchandise_exports_current_usd") ?? new Map();
  const importsRows = rowsByIndicator.get("merchandise_imports_current_usd") ?? new Map();
  const reserveRows = rowsByIndicator.get("official_reserves_including_gold_current_usd") ?? new Map();
  const records = [];

  for (const [iso3, country] of countryByIso3) {
    const exportsValue = exportsRows.get(iso3)?.value;
    const importsValue = importsRows.get(iso3)?.value;
    const reserveValue = reserveRows.get(iso3)?.value;
    const exportRow = exportsRows.get(iso3);
    const importRow = importsRows.get(iso3);
    const reserveRow = reserveRows.get(iso3);
    const wdiVersion = wdiRaw.indicators?.merchandise_exports_current_usd?.payload?.[0]?.lastupdated;
    const commonNote = `World Bank WDI ${YEAR}; source indicator last updated ${wdiVersion ?? "not provided"}. Values are current US$ and are not company revenue or profit.`;
    const exportObservationId = `macro-${iso3.toLowerCase()}-merchandise-exports`;
    const importObservationId = `macro-${iso3.toLowerCase()}-merchandise-imports`;

    records.push(
      makeMacroObservation({
        id: exportObservationId,
        entityId: country.id,
        indicator: "merchandise_exports_current_usd",
        value: exportsValue,
        method: "official",
        sourceId: SOURCE_IDS.wdi,
        statisticalConcept: "customs",
        notes: `${commonNote} Indicator TX.VAL.MRCH.CD.WT.`
      }),
      makeMacroObservation({
        id: importObservationId,
        entityId: country.id,
        indicator: "merchandise_imports_current_usd",
        value: importsValue,
        method: "official",
        sourceId: SOURCE_IDS.wdi,
        statisticalConcept: "customs",
        notes: `${commonNote} Indicator TM.VAL.MRCH.CD.WT.`
      })
    );

    const balance =
      typeof exportsValue === "number" && typeof importsValue === "number"
        ? exportsValue - importsValue
        : null;
    records.push(
      makeMacroObservation({
        id: `macro-${iso3.toLowerCase()}-merchandise-balance`,
        entityId: country.id,
        indicator: "merchandise_trade_balance_current_usd",
        value: balance,
        method: "derived",
        sourceId: SOURCE_IDS.wdi,
        statisticalConcept: "customs",
        notes:
          `Derived as merchandise exports minus merchandise imports for ${YEAR}. Input observation IDs: ${exportObservationId}, ${importObservationId}. Input datasetVersion: ${DATASET_ID}; WDI source version: ${wdiVersion ?? "version not provided"}. No additional rounding is applied after subtraction. Positive values indicate a surplus; this is not profit or domestic value added.`
      })
    );

    records.push(
      makeMacroObservation({
        id: `macro-${iso3.toLowerCase()}-official-reserves-including-gold`,
        entityId: country.id,
        indicator: "official_reserves_including_gold_current_usd",
        value: reserveValue,
        method: "official",
        sourceId: SOURCE_IDS.wdi,
        statisticalConcept: "official_reserve",
        notes:
          `World Bank WDI ${YEAR}, FI.RES.TOTL.CD. Official reserves include gold; this is not the narrower foreign-exchange-only reserve concept.${reserveRow?.obs_status ? ` WDI obs_status=${reserveRow.obs_status}.` : ""}`
      })
    );

    // Keep the source row statuses visible in the generated quality notes when
    // WDI marks an observation specially, without converting a missing value
    // into zero.
    for (const row of [exportRow, importRow, reserveRow]) {
      if (row?.obs_status) {
        // The notes above are intentionally stable; the raw snapshot remains
        // the authoritative place for the full source row metadata.
        void row;
      }
    }
  }
  return records;
}

function makeTradeObservation(row, reporter) {
  const direction = row.flowCode === "M" ? "import" : "export";
  const amount = typeof row.primaryValue === "number" && Number.isFinite(row.primaryValue)
    ? row.primaryValue
    : null;
  const valueDataStatus = amount === null ? "unknown" : "observed";
  const quantityEstimated = row.isQtyEstimated === true;
  const sourceQuantity = typeof row.qty === "number" && Number.isFinite(row.qty) ? row.qty : null;
  const quantity = !quantityEstimated && sourceQuantity !== null
    ? sourceQuantity
    : null;
  const quantityDataStatus = quantityEstimated
    ? "estimated"
    : quantity === null
      ? "unknown"
      : "observed";
  const id = `trade-${reporter.iso3.toLowerCase()}-smartphone-${direction}`;
  const quality = {
    source: "UN Comtrade Preview API",
    partnerCode: row.partnerCode,
    partner: "World total",
    cmdCode: row.cmdCode,
    classification: "HS 2022",
    customsCode: row.customsCode,
    primaryValueField: "primaryValue",
    legacyEstimationFlag: row.legacyEstimationFlag ?? null,
    isQtyEstimated: row.isQtyEstimated ?? null,
    isNetWgtEstimated: row.isNetWgtEstimated ?? null,
    qtyUnitCode: row.qtyUnitCode ?? null,
    valueDataStatus,
    quantityDataStatus,
    quantityPublicationRule:
      "primaryValue status is independent from quantity/net-weight flags; source-estimated quantities are not published as precise values",
    isReported: row.isReported ?? null,
    isAggregate: row.isAggregate ?? null,
    note: "A missing reporter/flow row is not interpreted as zero."
  };
  return {
    id,
    reporterEntityId: reporter.id,
    reporterCode: Number(row.reporterCode),
    // partnerCode=0 is the Comtrade world total, not one of the nine local
    // country entities, so it is represented as null in the domain contract.
    partnerEntityId: null,
    partnerCode: row.partnerCode === undefined || row.partnerCode === null ? null : Number(row.partnerCode),
    partner2Code: row.partner2Code === undefined || row.partner2Code === null ? null : Number(row.partner2Code),
    partnerScope: "world_total",
    direction,
    flowCode: row.flowCode,
    classificationSystem: "HS",
    classificationVersion: "2022",
    classificationCode: "851713",
    itemId: "generic-smartphone",
    period: period(),
    value: amount,
    quantity,
    currency: amount === null ? null : "USD",
    unit: sourceQuantity === null ? null : "items",
    statisticalConcept: "customs",
    sourceId: SOURCE_IDS.comtrade,
    datasetVersionId: DATASET_ID,
    method: "official",
    dataStatus: valueDataStatus,
    valueDataStatus,
    quantityDataStatus,
    quality: {
      legacyEstimationFlag: row.legacyEstimationFlag ?? null,
      isQtyEstimated: row.isQtyEstimated ?? null,
      isNetWgtEstimated: row.isNetWgtEstimated ?? null,
      isReported: row.isReported ?? null,
      isAggregate: row.isAggregate ?? null
    },
    qualityNote: JSON.stringify(quality)
  };
}

function assertComtradeRowScope(row) {
  const reporterCodes = new Set(
    [...countryByIso3.values()].map((country) => Number(country.reporterCode ?? country.m49))
  );
  const checks = [
    [row.typeCode === "C", "typeCode=C"],
    [row.freqCode === "A", "freqCode=A"],
    [String(row.period) === YEAR && Number(row.refYear) === Number(YEAR), `period=${YEAR}`],
    [row.classificationSearchCode === "HS" && row.classificationCode === "H6", "HS 2022/H6 classification"],
    [String(row.cmdCode) === "851713", "cmdCode=851713"],
    [Number(row.partnerCode) === 0, "partnerCode=0 world total"],
    [Number(row.partner2Code) === 0, "partner2Code=0"],
    [row.customsCode === "C00", "customsCode=C00"],
    [Number(row.motCode) === 0, "motCode=0"],
    [["M", "X"].includes(row.flowCode), "flowCode M or X"],
    [reporterCodes.has(Number(row.reporterCode)), "configured reporterCode"],
    [Number(row.qtyUnitCode) === 5, "qtyUnitCode=5 (items)"]
  ];
  const failed = checks.filter(([matches]) => !matches).map(([, label]) => label);
  if (failed.length > 0) {
    throw new Error(
      `Comtrade row is outside the reviewed published scope (${failed.join(", ")}): ${JSON.stringify({
        reporterCode: row.reporterCode,
        flowCode: row.flowCode,
        period: row.period,
        cmdCode: row.cmdCode,
        partnerCode: row.partnerCode,
        classificationCode: row.classificationCode,
        customsCode: row.customsCode
      })}`
    );
  }
}

function buildTradeObservations(comtradeRaw) {
  const byId = new Map();
  for (const row of parseComtradeRows(comtradeRaw)) {
    assertComtradeRowScope(row);
    const reporter = [...countryByIso3.values()].find((country) =>
      Number(country.reporterCode ?? country.m49) === Number(row.reporterCode)
    );
    if (!reporter) throw new Error(`Unexpected Comtrade reporterCode: ${row.reporterCode}`);
    const observation = makeTradeObservation(row, reporter);
    // A preview response should contain at most one world-total row per
    // reporter/flow. Keep deterministic first-seen behavior if upstream ever
    // returns duplicates.
    if (!byId.has(observation.id)) byId.set(observation.id, observation);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function bilateralRows(raw) {
  return (raw.bilateralResponses ?? []).flatMap((response) =>
    (response.payload?.data ?? []).map((row) => ({
      row,
      pairId: response.pairId,
      request: response.request,
      requestedAt: response.requestedAt,
      rawResponseSha256: response.rawResponseSha256,
      canonicalDataSha256: response.canonicalDataSha256
    }))
  );
}

function makeBilateralTradeObservation(entry) {
  const { row } = entry;
  const reporterEntityId = entityByComtradeCode.get(Number(row.reporterCode));
  const partnerEntityId = entityByComtradeCode.get(Number(row.partnerCode));
  if (!reporterEntityId || !partnerEntityId || Number(row.partnerCode) === 0) {
    throw new Error(
      `Bilateral observation requires configured specific endpoints: ${row.reporterCode}->${row.partnerCode}`
    );
  }
  const reporter = [...countryByIso3.values()].find((country) => country.id === reporterEntityId);
  if (!reporter) throw new Error(`Missing reporter dimension for ${reporterEntityId}`);
  const direction = row.flowCode === "M" ? "import" : "export";
  const amount = typeof row.primaryValue === "number" && Number.isFinite(row.primaryValue)
    ? row.primaryValue
    : null;
  const sourceQuantity = typeof row.qty === "number" && Number.isFinite(row.qty) ? row.qty : null;
  const quantityEstimated = row.isQtyEstimated === true;
  const quantity = !quantityEstimated ? sourceQuantity : null;
  const valueDataStatus = amount === null ? "unknown" : "observed";
  const quantityDataStatus = quantityEstimated
    ? "estimated"
    : quantity === null
      ? "unknown"
      : "observed";
  const pairKey = `${Number(row.reporterCode)}-${Number(row.partnerCode)}`;
  return {
    id: `trade-${reporter.iso3.toLowerCase()}-${pairKey}-smartphone-${direction}`,
    reporterEntityId,
    reporterCode: Number(row.reporterCode),
    partnerEntityId,
    partnerCode: Number(row.partnerCode),
    partner2Code: Number(row.partner2Code ?? 0),
    partnerScope: "entity",
    direction,
    flowCode: row.flowCode,
    classificationSystem: "HS",
    classificationVersion: "2022",
    classificationCode: "851713",
    itemId: "generic-smartphone",
    period: period(),
    value: amount,
    quantity,
    currency: amount === null ? null : "USD",
    unit: sourceQuantity === null ? null : "items",
    statisticalConcept: "customs",
    sourceId: SOURCE_IDS.comtrade,
    datasetVersionId: DATASET_ID,
    method: "official",
    dataStatus: valueDataStatus,
    valueDataStatus,
    quantityDataStatus,
    quality: {
      legacyEstimationFlag: row.legacyEstimationFlag ?? null,
      isQtyEstimated: row.isQtyEstimated ?? null,
      isNetWgtEstimated: row.isNetWgtEstimated ?? null,
      isReported: row.isReported ?? null,
      isAggregate: row.isAggregate ?? null
    },
    qualityNote: JSON.stringify({
      source: "UN Comtrade Preview API",
      observationScope: "specific bilateral reporter-partner observation",
      pairId: entry.pairId,
      reporterCode: Number(row.reporterCode),
      partnerCode: Number(row.partnerCode),
      reporterScope:
        Number(row.reporterCode) === 842
          ? "USA, Puerto Rico and US Virgin Islands (source-native Comtrade code 842; not ISO/M49 840)"
          : row.reporterDesc,
      partnerScope:
        Number(row.partnerCode) === 842
          ? "USA, Puerto Rico and US Virgin Islands (source-native Comtrade code 842; not ISO/M49 840)"
          : row.partnerDesc,
      flowCode: row.flowCode,
      valuation: row.flowCode === "M" ? "CIF" : "FOB",
      classification: "HS 2022",
      cmdCode: String(row.cmdCode),
      customsCode: row.customsCode,
      currency: "USD",
      primaryValueField: "primaryValue",
      qtyUnitCode: row.qtyUnitCode ?? null,
      isQtyEstimated: row.isQtyEstimated ?? null,
      isNetWgtEstimated: row.isNetWgtEstimated ?? null,
      isReported: row.isReported ?? null,
      isAggregate: row.isAggregate ?? null,
      legacyEstimationFlag: row.legacyEstimationFlag ?? null,
      requestUrl: entry.request?.url ?? null,
      requestedAt: entry.requestedAt,
      rawResponseSha256: entry.rawResponseSha256,
      canonicalDataSha256: entry.canonicalDataSha256,
      interpretation:
        "This proves only the reported HS 851713 customs observation for the exact reporter, partner, direction and period. It does not prove assembly, final consumption, a factory, or entry into a particular supply chain. Mirror reports remain separate because CIF/FOB valuation and reporting systems differ."
    })
  };
}

function buildBilateralTradeObservations(bilateralRaw) {
  const observations = bilateralRows(bilateralRaw).map(makeBilateralTradeObservation);
  const ids = new Set(observations.map((observation) => observation.id));
  if (ids.size !== observations.length) {
    throw new Error("Duplicate bilateral trade observation ID");
  }
  return observations.sort((left, right) => left.id.localeCompare(right.id));
}

function buildMaterialTradeObservations(raw) {
  const itemByCode = { "7403": "copper", "7601": "aluminum", "283691": "lithium", "8105": "cobalt", "7502": "nickel", "250410": "graphite" };
  return (raw.responses ?? []).flatMap((response) => (response.payload?.data ?? []).map((row, index) => {
    const code = String(row.cmdCode);
    const partnerCode = Number(row.partnerCode);
    const amount = typeof row.primaryValue === "number" ? row.primaryValue : null;
    const estimated = row.isQtyEstimated === true;
    return {
      observationId: `material-${itemByCode[code]}-${partnerCode}-${row.flowCode}-${index}`,
      materialItemId: itemByCode[code], reporterEntityId: entityByComtradeCode.get(Number(row.reporterCode)), partnerEntityId: partnerCode === 0 ? null : entityByComtradeCode.get(partnerCode),
      reporterCode: Number(row.reporterCode), partnerCode, partnerScope: partnerCode === 0 ? "world_total" : "entity",
      flow: row.flowCode === "M" ? "import" : "export", classificationSystem: "HS", classificationVersion: "2022", classificationCode: code,
      classificationMappingType: ["283691", "250410"].includes(code) ? "exact" : "aggregate", period: PERIOD, currency: amount === null ? null : "USD", value: amount,
      quantity: estimated ? null : (typeof row.qty === "number" ? row.qty : null), valueDataStatus: amount === null ? "unknown" : "observed", quantityDataStatus: estimated ? "estimated" : (row.qty == null ? "unknown" : "observed"),
      quality: { isQtyEstimated: row.isQtyEstimated ?? null, isAggregate: row.isAggregate ?? null, isReported: row.isReported ?? null, rawResponseSha256: response.responseSha256 },
      sourceId: SOURCE_IDS.comtrade, datasetVersionId: DATASET_ID, method: "official", evidenceLevel: "bilateral_supported",
      limitation: "该海关分类仅证明报告方与伙伴发生该分类商品贸易，不证明材料进入手机、电池、指定工厂或连续物料谱系。"
    };
  }));
}

function makeBilateralEvidence(bilateralRaw) {
  const routeEvidence = [
    {
      id: "evidence-comtrade-china-united-states-smartphone-bilateral-export-2023",
      reporterCode: 156,
      partnerCode: 842,
      direction: "export",
      fromEntityId: "country-cn",
      toEntityId: "country-us"
    },
    {
      id: "evidence-comtrade-united-states-china-smartphone-bilateral-import-2023",
      reporterCode: 842,
      partnerCode: 156,
      direction: "import",
      fromEntityId: "country-cn",
      toEntityId: "country-us"
    },
    {
      id: "evidence-comtrade-china-germany-smartphone-bilateral-export-2023",
      reporterCode: 156,
      partnerCode: 276,
      direction: "export",
      fromEntityId: "country-cn",
      toEntityId: "country-de"
    },
    {
      id: "evidence-comtrade-germany-china-smartphone-bilateral-import-2023",
      reporterCode: 276,
      partnerCode: 156,
      direction: "import",
      fromEntityId: "country-cn",
      toEntityId: "country-de"
    }
  ];
  return routeEvidence.map((definition) => {
    const entry = bilateralRows(bilateralRaw).find(
      ({ row }) =>
        Number(row.reporterCode) === definition.reporterCode &&
        Number(row.partnerCode) === definition.partnerCode &&
        (row.flowCode === "M" ? "import" : "export") === definition.direction
    );
    if (!entry) throw new Error(`Missing bilateral evidence row: ${definition.id}`);
    return {
      id: definition.id,
      sourceId: SOURCE_IDS.comtrade,
      supportType: "bilateral_flow",
      scope: {
        entityIds: [definition.fromEntityId, definition.toEntityId],
        fromEntityId: definition.fromEntityId,
        toEntityId: definition.toEntityId,
        itemIds: ["generic-smartphone"],
        processStageIds: [],
        classificationCodes: [
          {
            system: "HS",
            version: "2022",
            code: "851713",
            mappingType: "exact",
            description: "Smartphones"
          }
        ],
        direction: definition.direction,
        period: period(),
        scopeDescription:
          `Source-reported ${definition.direction} observation for reporterCode=${definition.reporterCode}, partnerCode=${definition.partnerCode}, HS 2022/851713 in ${YEAR}.`,
        supportsCountryRole: true,
        supportsBilateralFlow: true,
        supportsProcessContext: false,
        limitations: [
          "Supports only the exact customs category, reporter, partner, direction and period; not an assembly or consumption claim.",
          "Does not prove a brand, model, factory, component origin, cost, profit or a physical batch route.",
          "The mirror reporter observation is independent and is not averaged or substituted for this observation."
        ]
      },
      locator:
        `${entry.request?.url}; rawResponseSha256=${entry.rawResponseSha256}; canonicalDataSha256=${entry.canonicalDataSha256}`,
      excerpt: null,
      notes:
        "Direct bilateral customs evidence. It may support a narrowly worded HS 851713 bilateral trade claim, but not the current assembly-to-market supply-chain edge in full."
    };
  });
}

function countryRoleScope(entityId, itemId, processStageId, scopeDescription, limitations) {
  return {
    entityIds: [entityId],
    fromEntityId: null,
    toEntityId: null,
    itemIds: [itemId],
    processStageIds: [processStageId],
    classificationCodes: [],
    direction: null,
    period: period(),
    scopeDescription,
    supportsCountryRole: true,
    supportsBilateralFlow: false,
    supportsProcessContext: false,
    limitations
  };
}

function makeSourceAndEvidence(wdiRaw, comtradeRaw, bilateralRaw, industryRoleContent) {
  const wdiRetrieved = wdiRaw.fetchedAt ?? "2026-08-25";
  const comtradeRetrieved = comtradeRaw.fetchedAt ?? "2026-08-25";
  const comtradeUrl = comtradeRaw.request?.url ?? "https://comtradeapi.un.org/public/v1/preview/C/A/HS";
  const bilateralRetrieved = bilateralRaw.fetchedAt ?? comtradeRetrieved;
  const wdiLastUpdated = wdiRaw.indicators?.merchandise_exports_current_usd?.payload?.[0]?.lastupdated ?? null;
  const sources = [
    sourceDefinition(wdiRaw, SOURCE_IDS.wdi, {
      name: "World Development Indicators",
      publisher: "World Bank",
      url: "https://databank.worldbank.org/source/world-development-indicators",
      license: "CC BY 4.0 (World Bank public license; indicator-specific terms apply)",
      publishedAt: wdiLastUpdated,
      notes:
        "WDI indicators TX.VAL.MRCH.CD.WT, TM.VAL.MRCH.CD.WT and FI.RES.TOTL.CD. Underlying publishers shown by WDI include WTO for merchandise trade and IMF International Financial Statistics for reserves. API snapshot and hash are in data/published/raw/world-bank-wdi-2023.json. Public licence information: https://datacatalog.worldbank.org/public-licenses; indicator-specific exceptions remain controlling."
    }, `WDI-${wdiLastUpdated ?? YEAR}`),
    sourceDefinition(comtradeRaw, SOURCE_IDS.comtrade, {
      name: "UN Comtrade Public API",
      publisher: "United Nations Statistics Division",
      url: comtradeUrl,
      license: "UN Comtrade License Agreement and Policy on Use and Re-dissemination; not CC BY",
      publishedAt: null,
      notes:
        `HS 2022 code 851713 annual customs observations for ${YEAR}, including separate partnerCode=0 world totals and specific China↔USA statistical area / China↔Germany reporter-partner rows. Mirror reports remain separate. Monetary primaryValue status is assessed separately from quantity and net-weight estimation flags; source-estimated quantities are not published as precise quantities. Preserve UN attribution and comply with the current terms at https://comtradeplus.un.org/LicenseAgreement, https://comtradeplus.un.org/PolicyOnUseAndRedissemination and https://www.un.org/en/about-us/terms-of-use. World-total snapshot retrieved ${comtradeRetrieved}; bilateral snapshot retrieved ${bilateralRetrieved}; raw response and canonical data hashes are retained locally.`
    }, `un-comtrade-hs2022-851713-${YEAR}`),
    {
      id: SOURCE_IDS.m49,
      name: "UN M49 geographic area codes",
      publisher: "United Nations Statistics Division",
      url: "https://unstats.un.org/unsd/methodology/m49/",
      license: "United Nations terms of use; reference mapping only",
      publishedAt: null,
      retrievedAt: "2026-08-25T00:00:00+08:00",
      datasetVersion: "UN-M49-2026",
      notes:
        "Provides the numeric country/area crosswalk used with ISO3 and UN Comtrade reporter codes. It is a statistical reference dimension, not a political boundary determination."
    },
    {
      id: SOURCE_IDS.usgs,
      name: "Mineral Commodity Summaries",
      publisher: "U.S. Geological Survey",
      url: "https://pubs.usgs.gov/periodicals/mcs2024/mcs2024.pdf",
      license: "U.S. Government work; public-domain status and USGS terms apply",
      publishedAt: "2024-01-31",
      retrievedAt: "2026-08-25T00:00:00+08:00",
      datasetVersion: "MCS-2024",
      notes:
        "Used only for the specifically cited mineral/country role records. It does not prove a smartphone batch, company, bilateral shipment or unique route. USGS copyright and reuse information: https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits."
    },
    {
      id: SOURCE_IDS.iea,
      name: "Global supply chains of EV batteries",
      publisher: "International Energy Agency",
      url: "https://www.iea.org/reports/global-supply-chains-of-ev-batteries",
      license: "IEA terms of use; link-only citation in this fixture, not a CC BY relicense",
      publishedAt: "2022-07-01",
      retrievedAt: "2026-08-25T00:00:00+08:00",
      datasetVersion: "IEA-2022",
      notes:
        "Used only as contextual evidence for general battery-chain stages and concentration. This EV-battery report does not prove a smartphone-specific country route. IEA terms: https://www.iea.org/terms."
    },
    {
      id: SOURCE_IDS.routeMethod,
      name: "GlobeChain representative route methodology",
      publisher: "GlobeChain",
      url: null,
      license: "Project-authored methodology; repository terms apply",
      publishedAt: "2026-08-25",
      retrievedAt: "2026-08-25T00:00:00+08:00",
      datasetVersion: "smartphone-route-2023.2",
      notes:
        "Documents how reviewed country-role evidence and contextual stage evidence are connected into a quantity-free representative route. It is a curation method, not an external factual source and not proof of bilateral trade."
    }
  ];
  const evidence = [
    {
      id: "evidence-usgs-australia-lithium-role",
      sourceId: SOURCE_IDS.usgs,
      supportType: "country_role",
      scope: countryRoleScope(
        "country-au",
        "lithium",
        "extraction",
        "Supports Australia's lithium mine-production role in the 2023 context.",
        ["Does not identify a destination, material grade, battery use or smartphone use."]
      ),
      locator: "Mineral Commodity Summaries 2024 PDF, Lithium chapter, World Mine Production and Reserves table: Australia",
      excerpt: null,
      notes: "Supports Australia's lithium production role for the 2023 context only; it does not identify a destination country or smartphone use."
    },
    {
      id: "evidence-usgs-drc-cobalt-role",
      sourceId: SOURCE_IDS.usgs,
      supportType: "country_role",
      scope: countryRoleScope(
        "country-cd",
        "cobalt",
        "extraction",
        "Supports the Democratic Republic of the Congo's cobalt mine-production role in the 2023 context.",
        ["Does not identify a destination, refining chain, battery use or smartphone use."]
      ),
      locator: "Mineral Commodity Summaries 2024 PDF, Cobalt chapter, World Mine Production and Reserves table: Congo (Kinshasa)",
      excerpt: null,
      notes: "Supports the Democratic Republic of the Congo's cobalt production role only; no bilateral shipment is established."
    },
    {
      id: "evidence-usgs-indonesia-nickel-role",
      sourceId: SOURCE_IDS.usgs,
      supportType: "country_role",
      scope: countryRoleScope(
        "country-id",
        "nickel",
        "extraction",
        "Supports Indonesia's nickel mine-production role in the 2023 context.",
        ["Does not identify a destination, intermediate product, battery use or smartphone use."]
      ),
      locator: "Mineral Commodity Summaries 2024 PDF, Nickel chapter, World Mine Production and Reserves table: Indonesia",
      excerpt: null,
      notes: "Supports Indonesia's nickel production role only; no bilateral shipment is established."
    },
    {
      id: "evidence-usgs-china-graphite-role",
      sourceId: SOURCE_IDS.usgs,
      supportType: "country_role",
      scope: countryRoleScope(
        "country-cn",
        "graphite",
        "extraction",
        "Supports China's natural-graphite mine-production role in the 2023 context.",
        ["Does not support processed graphite, anode production, a factory or smartphone use."]
      ),
      locator: "Mineral Commodity Summaries 2024 PDF, Graphite (Natural) chapter, World Mine Production and Reserves table: China",
      excerpt: null,
      notes: "Supports China's natural-graphite production role only; it does not prove use in a particular anode or smartphone."
    },
    {
      id: "evidence-usgs-chile-copper-role",
      sourceId: SOURCE_IDS.usgs,
      supportType: "country_role",
      scope: countryRoleScope(
        "country-cl",
        "copper",
        "extraction",
        "Supports Chile's copper mine-production role in the 2023 context.",
        ["Does not support refining, foil manufacture, current collectors or smartphone use."]
      ),
      locator: "Mineral Commodity Summaries 2024 PDF, Copper chapter, World Mine Production and Reserves table: Chile",
      excerpt: null,
      notes: "Supports Chile's copper mine-production role only; downstream refining and foil manufacture are not evidenced by this record."
    },
    {
      id: "evidence-usgs-australia-aluminum-role",
      sourceId: SOURCE_IDS.usgs,
      supportType: "country_role",
      scope: countryRoleScope(
        "country-au",
        "aluminum",
        "extraction",
        "Supports Australia's upstream bauxite/alumina role in the 2023 context.",
        ["The internal aluminum item is broad; the evidence does not mean metallic aluminum is mined or prove foil/current-collector use."]
      ),
      locator: "Mineral Commodity Summaries 2024 PDF, Bauxite and Alumina and Aluminum chapters, world production tables: Australia",
      excerpt: null,
      notes: "Supports an Australian upstream bauxite/alumina role. The current broad aluminum item must not be read as metallic aluminum being directly mined."
    },
    {
      id: "evidence-iea-battery-chain",
      sourceId: SOURCE_IDS.iea,
      supportType: "process_context",
      scope: {
        entityIds: [],
        fromEntityId: null,
        toEntityId: null,
        itemIds: ["battery", "cathode-material", "anode-material", "cell", "battery-module"],
        processStageIds: ["refining", "material_processing", "component_manufacturing", "assembly"],
        classificationCodes: [],
        direction: null,
        period: period(),
        scopeDescription: "General contextual support for multi-stage battery supply chains.",
        supportsCountryRole: false,
        supportsBilateralFlow: false,
        supportsProcessContext: true,
        limitations: [
          "The report concerns EV batteries and does not establish a smartphone-specific route.",
          "It does not support the current route's country-to-country connections or quantities."
        ]
      },
      locator: "Executive summary and supply-chain concentration sections",
      excerpt: null,
      notes: "Supports the existence of multi-stage EV-battery material, cell and module stages as context only; no smartphone-specific country route or quantity is inferred."
    },
    {
      id: "evidence-un-m49-crosswalk",
      sourceId: SOURCE_IDS.m49,
      supportType: "classification",
      scope: {
        entityIds: [...countryByIso3.values()].map((country) => country.id),
        fromEntityId: null,
        toEntityId: null,
        itemIds: [],
        processStageIds: [],
        classificationCodes: [],
        direction: null,
        period: period(),
        scopeDescription: "Geographic reference codes for the fixture country dimension.",
        supportsCountryRole: false,
        supportsBilateralFlow: false,
        supportsProcessContext: false,
        limitations: ["A geographic code crosswalk is not evidence for a production or trade claim."]
      },
      locator: "UN M49 country or area codes table; numeric codes 036, 152, 156, 180, 276, 360, 392, 410 and 840",
      excerpt: null,
      notes: "Supports the country/area dimension crosswalk used in this fixture."
    },
    {
      id: "evidence-comtrade-china-smartphone-world-total",
      sourceId: SOURCE_IDS.comtrade,
      supportType: "trade_observation",
      scope: {
        entityIds: ["country-cn"], fromEntityId: null, toEntityId: null,
        itemIds: ["generic-smartphone"], processStageIds: [],
        classificationCodes: [{ system: "HS", version: "2022", code: "851713", mappingType: "exact", description: "Smartphones" }],
        direction: null, period: period(),
        scopeDescription: "China's HS 2022/851713 imports from and exports to partnerCode=0 (world total).",
        supportsCountryRole: false, supportsBilateralFlow: false, supportsProcessContext: false,
        limitations: ["partnerCode=0 is the world total, not a specific country.", "Does not support assembly or a bilateral route."]
      },
      locator: `UN Comtrade snapshot query for ${YEAR}, reporterCode=156, partnerCode=0, HS 2022 code 851713, flowCode=M/X; observations trade-chn-smartphone-import and trade-chn-smartphone-export`,
      excerpt: null,
      notes: "Supports only China's reported smartphone imports from and exports to the world total. It does not prove assembly location or a bilateral flow to the United States or Germany."
    },
    {
      id: "evidence-comtrade-united-states-smartphone-world-total",
      sourceId: SOURCE_IDS.comtrade,
      supportType: "trade_observation",
      scope: {
        entityIds: ["country-us"], fromEntityId: null, toEntityId: null,
        itemIds: ["generic-smartphone"], processStageIds: [],
        classificationCodes: [{ system: "HS", version: "2022", code: "851713", mappingType: "exact", description: "Smartphones" }],
        direction: null, period: period(),
        scopeDescription: "US Comtrade statistical area's HS 2022/851713 imports from and exports to partnerCode=0 (world total).",
        supportsCountryRole: false, supportsBilateralFlow: false, supportsProcessContext: false,
        limitations: ["partnerCode=0 is the world total, not China.", "ReporterCode 842 includes Puerto Rico and the US Virgin Islands.", "Does not prove distribution or consumption."]
      },
      locator: `UN Comtrade snapshot query for ${YEAR}, reporterCode=842, partnerCode=0, HS 2022 code 851713, flowCode=M/X; observations trade-usa-smartphone-import and trade-usa-smartphone-export`,
      excerpt: null,
      notes: "Supports only United States smartphone trade with the world total. It does not identify China as partner and does not prove distribution activity."
    },
    {
      id: "evidence-comtrade-germany-smartphone-world-total",
      sourceId: SOURCE_IDS.comtrade,
      supportType: "trade_observation",
      scope: {
        entityIds: ["country-de"], fromEntityId: null, toEntityId: null,
        itemIds: ["generic-smartphone"], processStageIds: [],
        classificationCodes: [{ system: "HS", version: "2022", code: "851713", mappingType: "exact", description: "Smartphones" }],
        direction: null, period: period(),
        scopeDescription: "Germany's HS 2022/851713 imports from and exports to partnerCode=0 (world total).",
        supportsCountryRole: false, supportsBilateralFlow: false, supportsProcessContext: false,
        limitations: ["partnerCode=0 is the world total, not China.", "Imports do not equal final consumption."]
      },
      locator: `UN Comtrade snapshot query for ${YEAR}, reporterCode=276, partnerCode=0, HS 2022 code 851713, flowCode=M/X; observations trade-deu-smartphone-import and trade-deu-smartphone-export`,
      excerpt: null,
      notes: "Supports only Germany's smartphone trade with the world total. Imports do not equal final consumption and do not identify China as partner."
    },
    {
      id: "evidence-globe-chain-route-methodology",
      sourceId: SOURCE_IDS.routeMethod,
      supportType: "curation_method",
      scope: {
        entityIds: [], fromEntityId: null, toEntityId: null,
        itemIds: [], processStageIds: [], classificationCodes: [], direction: null,
        period: period(),
        scopeDescription: "GlobeChain's method for representing evidence-limited, quantity-free supply-chain connections.",
        supportsCountryRole: false, supportsBilateralFlow: false, supportsProcessContext: false,
        limitations: ["Project methodology is not external factual evidence for a country role or bilateral flow."]
      },
      locator: "content/routes/generic-smartphone-2023.json and data/published/README.md, representative supply-route methodology and limitations",
      excerpt: null,
      notes: "Explains why the route uses representative connections. It is not evidence of a factual bilateral shipment."
    }
  ];
  const externalSourceIds = new Set(sources.map((source) => source.id));
  for (const source of industryRoleContent.sources ?? []) {
    if (externalSourceIds.has(source.id)) throw new Error(`Duplicate industry-role source: ${source.id}`);
    sources.push(clone(source));
    externalSourceIds.add(source.id);
  }
  evidence.push(
    ...(industryRoleContent.evidence ?? []).map(clone),
    ...makeBilateralEvidence(bilateralRaw)
  );
  return { sources, evidence };
}

function applyCatalogMetadata(fixture) {
  fixture.entities = fixture.entities.map((entity) => ({
    ...entity,
    m49: [...countryByIso3.values()].find((country) => country.id === entity.id)?.m49 ?? null,
    sourceIds: [SOURCE_IDS.wdi, SOURCE_IDS.m49],
    method: "official",
    dataStatus: "observed",
    datasetVersionId: DATASET_ID,
    validPeriod: period()
  }));
  fixture.items = fixture.items.map((item) => ({
    ...item,
    sourceIds: [SOURCE_IDS.routeMethod],
    method: "curated",
    dataStatus: "observed",
    datasetVersionId: DATASET_ID,
    validPeriod: period()
  }));
  fixture.processStages = fixture.processStages.map((stage) => ({
    ...stage,
    sourceIds: [SOURCE_IDS.routeMethod],
    method: "curated",
    dataStatus: "observed",
    datasetVersionId: DATASET_ID
  }));
  fixture.classificationCodes = fixture.classificationCodes.map((code) => {
    const smartphone = code.code === "851713";
    return {
      ...code,
      label: smartphone ? "Smartphones（智能手机）" : "Lithium-ion accumulators（锂离子蓄电池）",
      sourceIds: [SOURCE_IDS.comtrade],
      method: smartphone ? "official" : "curated",
      dataStatus: "observed",
      datasetVersionId: DATASET_ID,
      validPeriod: period()
    };
  });
  fixture.classificationCrosswalks = fixture.classificationCrosswalks.map((mapping) => {
    const smartphone = mapping.itemId === "generic-smartphone";
    return {
      ...mapping,
      mappingType: smartphone ? "exact" : "aggregate",
      confidence: smartphone ? 1 : null,
      notes: smartphone
        ? "HS 2022 six-digit code 851713 is used for the smartphone product slice."
        : "HS 2022 850760 is a broader lithium-ion accumulator category; it is not asserted to equal all smartphone batteries.",
      period: period(),
      sourceIds: smartphone ? [SOURCE_IDS.comtrade] : [SOURCE_IDS.routeMethod],
      method: "curated",
      dataStatus: "observed",
      datasetVersionId: DATASET_ID
    };
  });
}

function applyRouteContent(fixture, routeContent) {
  if (routeContent.productId !== fixture.productId) {
    throw new Error(`Route content productId mismatch: ${routeContent.productId}`);
  }
  if (routeContent.contentVersion?.id !== CONTENT_VERSION_ID) {
    throw new Error(`Unexpected route content version: ${routeContent.contentVersion?.id}`);
  }

  fixture.contentVersions = [clone(routeContent.contentVersion)];
  fixture.productionActivities = routeContent.productionActivities.map((activity) => ({
    ...clone(activity),
    period: period(),
    datasetVersionId: DATASET_ID,
    contentVersionId: CONTENT_VERSION_ID
  }));
  fixture.storyGraph = {
    productId: fixture.productId,
    period: period(),
    method: routeContent.method,
    representativeStatement: routeContent.representativeStatement,
    methodology: [...routeContent.methodology],
    limitations: [...routeContent.limitations],
    nodes: routeContent.nodes.map((node) => ({
      ...clone(node),
      period: period(),
      datasetVersionId: DATASET_ID,
      contentVersionId: CONTENT_VERSION_ID
    })),
    flows: routeContent.flows.map((flow) => ({
      ...clone(flow),
      period: period(),
      value: null,
      quantity: null,
      currency: null,
      unit: null,
      confidence: null,
      datasetVersionId: DATASET_ID,
      contentVersionId: CONTENT_VERSION_ID
    })),
    steps: routeContent.steps.map((step) => ({
      ...clone(step),
      contentVersionId: CONTENT_VERSION_ID
    })),
    datasetVersionId: DATASET_ID,
    contentVersionId: CONTENT_VERSION_ID,
    warnings: [
      routeContent.representativeStatement,
      "当前发布路线的所有边均为 representative；没有一条边具有 direct bilateral evidence。",
      "路线没有数量或金额；valueDataStatus 与 quantityDataStatus 均为 unknown，不能解读为 0。"
    ]
  };
}

function buildFixture(
  sample,
  routeContent,
  wdiRaw,
  comtradeRaw,
  bilateralRaw,
  materialRaw,
  industryRoleContent,
  gapRegistry
) {
  const fixture = clone(sample);
  fixture.schemaVersion = "product-fixture.v1";
  fixture.productId = "generic-smartphone";
  fixture.datasetVersion = {
    id: DATASET_ID,
    name: "GlobeChain 通用智能手机 2023 published 数据集",
    version: DATASET_VERSION,
    publishedAt: "2026-08-25",
    sourceIds: [
      SOURCE_IDS.wdi,
      SOURCE_IDS.comtrade,
      SOURCE_IDS.m49,
      SOURCE_IDS.usgs,
      SOURCE_IDS.iea,
      SOURCE_IDS.routeMethod,
      ...(industryRoleContent.sources ?? []).map((source) => source.id)
    ],
    coverage: null,
    status: "published",
    notes:
      "2023 完整自然年；宏观指标来自 WDI，智能手机单品观察来自 UN Comtrade HS 2022 851713，路线为数量未知的代表性策展内容。"
  };
  const { sources, evidence } = makeSourceAndEvidence(
    wdiRaw,
    comtradeRaw,
    bilateralRaw,
    industryRoleContent
  );
  fixture.sources = sources;
  fixture.evidence = evidence;
  fixture.evidenceGaps = (gapRegistry.evidenceGaps ?? []).map(clone);
  applyCatalogMetadata(fixture);
  applyRouteContent(fixture, routeContent);
  fixture.tradeObservations = [
    ...buildTradeObservations(comtradeRaw),
    ...buildBilateralTradeObservations(bilateralRaw)
  ].sort((left, right) => left.id.localeCompare(right.id));
  fixture.materialTradeObservations = buildMaterialTradeObservations(materialRaw);
  fixture.macroIndicators = buildMacroIndicators(wdiRaw);
  fixture.indicatorDefinitions = buildIndicatorDefinitions();
  fixture.missingDataNotes = [
    "UN Comtrade 的 partnerCode=0 表示世界总计，不是一个具体国家；页面不会把它链接成某个国家。",
    "2023 年 UN Comtrade HS 2022/851713 查询没有返回刚果民主共和国（COD）的行；缺少观察保持未知，不解释为贸易额为 0。",
    "FI.RES.TOTL.CD 是 World Bank WDI 的 Total reserves（includes gold, current US$），本数据集显示为官方储备总额（含黄金）。",
    "商品海关贸易金额不等于企业利润、生产成本、国内增加值或手机零售价格。",
    "UN Comtrade 的 primaryValue 金额状态与数量/净重估算标记分开处理；isQtyEstimated=true 的数量不作为精确数量发布。",
    "unknown、未披露、估算和真实为零是不同语义；没有观察时不会补写 0。",
    "当前供应链路线的 13 条边全部是 representative 策展连接；新增双边 HS 851713 海关观察只支持有限的分类商品贸易主张，不自动证明组装节点到市场节点的完整路线。",
    "USGS 证据支持的是澳大利亚锂、刚果民主共和国钴、印度尼西亚镍、中国石墨、智利铜和澳大利亚铝相关上游角色，不证明这些国家之间的具体运输。",
    "新增国家角色证据分别说明中国移动通信手持机生产、韩国通用电芯供应链、日本宽泛电子组件/LCD 生产以及美德进口市场；每条证据的商品和用途局限保存在 scope 中，相邻边不升级。",
    "partnerCode=0 世界总计观察与具体 partnerCode 双边观察分开保存；两个世界总计观察仍不能拼成双边事实，镜像双边报告也不平均或合并。",
    "铜和铝在当前路线中作为简化的电芯相关材料输入，中间冶炼和箔材加工阶段尚未发布。"
  ];
  fixture.warnings = [
    "本数据集使用 2023 完整自然年；不混合其他年份或财年。",
    "智能手机单品贸易为 HS 2022 六位码 851713、世界总计伙伴的海关观察；缺失国家/流向不填零。",
    "官方储备指标 FI.RES.TOTL.CD 包含黄金，不等同于狭义外汇储备。",
    "电池供应链是有来源的代表性策展路径，不代表唯一真实路线，也不提供成本、增加值或利润分配。",
    "Comtrade 估算和质量标记保存在 qualityNote，并影响独立的金额/数量状态；运行时不请求外部 API。",
    "所有现有路线边均为 representative 且数量未知；双边海关 evidence 和 observations 不等于路线边已被证明。"
  ];
  return fixture;
}

function assertBuildInvariants(fixture, comtradeRaw) {
  if (fixture.datasetVersion.status !== "published") throw new Error("Published fixture must have published dataset status");
  if (fixture.datasetVersion.id !== DATASET_ID) throw new Error("Unexpected dataset ID");
  if (fixture.storyGraph.datasetVersionId !== DATASET_ID) throw new Error("Story graph dataset mismatch");
  if (fixture.storyGraph.contentVersionId !== CONTENT_VERSION_ID) throw new Error("Story graph content-version mismatch");
  if (!fixture.contentVersions.some((version) => version.id === CONTENT_VERSION_ID && version.status === "published")) {
    throw new Error("Published route content version is missing");
  }
  const evidenceById = new Map(fixture.evidence.map((record) => [record.id, record]));
  const nodeIds = new Set(fixture.storyGraph.nodes.map((node) => node.id));
  const routeRecords = [
    ...fixture.storyGraph.nodes,
    ...fixture.storyGraph.flows,
    ...fixture.productionActivities
  ];
  for (const record of routeRecords) {
    if (record.period?.label !== YEAR) throw new Error(`Route record period mismatch: ${record.id}`);
    if (record.datasetVersionId !== DATASET_ID) throw new Error(`Route record dataset mismatch: ${record.id}`);
    if (record.contentVersionId !== CONTENT_VERSION_ID) throw new Error(`Route record content mismatch: ${record.id}`);
    if (!Array.isArray(record.evidenceIds) || record.evidenceIds.length === 0) {
      throw new Error(`Route record must have direct evidence references: ${record.id}`);
    }
    for (const evidenceId of record.evidenceIds) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) throw new Error(`Unknown route evidence ${evidenceId} on ${record.id}`);
      if (!record.sourceIds.includes(evidence.sourceId)) {
        throw new Error(`Route record ${record.id} must include evidence source ${evidence.sourceId}`);
      }
    }
  }
  for (const step of fixture.storyGraph.steps) {
    if (step.method !== "curated" || step.contentVersionId !== CONTENT_VERSION_ID) {
      throw new Error(`Story step metadata mismatch: ${step.id}`);
    }
    if (step.evidenceIds.some((evidenceId) => !evidenceById.has(evidenceId))) {
      throw new Error(`Story step references unknown evidence: ${step.id}`);
    }
  }
  for (const flow of fixture.storyGraph.flows) {
    if (!nodeIds.has(flow.fromEntityId) || !nodeIds.has(flow.toEntityId)) {
      throw new Error(`Published flow endpoints must reference story nodes: ${flow.id}`);
    }
    if (
      flow.evidenceLevel !== "representative" ||
      flow.dataStatus !== "unknown" ||
      flow.valueDataStatus !== "unknown" ||
      flow.quantityDataStatus !== "unknown" ||
      flow.value !== null ||
      flow.quantity !== null
    ) {
      throw new Error(`Published route flow must remain representative and quantity-free: ${flow.id}`);
    }
  }
  if (fixture.storyGraph.flows.some((flow) => flow.evidenceLevel === "bilateral_supported")) {
    throw new Error("The current route has no direct bilateral evidence");
  }
  if (fixture.tradeObservations.some((row) => row.period.label !== YEAR)) throw new Error("Trade period mismatch");
  if (fixture.macroIndicators.some((row) => row.period.label !== YEAR)) throw new Error("Macro period mismatch");
  const worldTotalRows = fixture.tradeObservations.filter(
    (row) => row.partnerScope === "world_total"
  );
  const bilateralRowsInFixture = fixture.tradeObservations.filter(
    (row) => row.partnerScope === "entity"
  );
  if (
    worldTotalRows.some((row) => row.partnerCode !== 0 || row.partnerEntityId !== null)
  ) {
    throw new Error("World-total observations must retain partnerCode=0 and no entity partner");
  }
  if (
    bilateralRowsInFixture.some(
      (row) => row.partnerCode === 0 || row.partnerEntityId === null
    )
  ) {
    throw new Error("Specific bilateral observations require a non-zero partner and entity link");
  }
  if (worldTotalRows.length === 0 || bilateralRowsInFixture.length !== 8) {
    throw new Error("Expected both world-total observations and eight bilateral reporter rows");
  }
  if (fixture.tradeObservations.some((row) => row.valueDataStatus !== row.dataStatus)) {
    throw new Error("Trade monetary status must match the observation dataStatus");
  }
  const materialObservations = fixture.materialTradeObservations ?? [];
  if (materialObservations.length === 0) throw new Error("Material observations are required for the published material layer");
  for (const row of materialObservations) {
    if (row.period.label !== YEAR || row.datasetVersionId !== DATASET_ID) throw new Error(`Material observation period/dataset mismatch: ${row.observationId}`);
    if (row.partnerCode === 0 && (row.partnerScope !== "world_total" || row.partnerEntityId !== null)) throw new Error(`Material world total invariant failed: ${row.observationId}`);
    if (row.partnerCode !== 0 && (row.partnerScope !== "entity" || !row.partnerEntityId)) throw new Error(`Material bilateral partner invariant failed: ${row.observationId}`);
    if (row.evidenceLevel !== "bilateral_supported") throw new Error(`Material observation evidence level mismatch: ${row.observationId}`);
    if (row.classificationMappingType === "aggregate" || row.classificationMappingType === "approximate") {
      if (!row.limitation.includes("不证明材料进入手机")) throw new Error(`Material classification limitation missing: ${row.observationId}`);
    }
    if (row.quantityDataStatus === "estimated" && row.quantity !== null) throw new Error(`Estimated material quantity must be null: ${row.observationId}`);
  }
  if (
    fixture.tradeObservations.some(
      (row) => row.quantityDataStatus === "estimated" && row.quantity !== null
    )
  ) {
    throw new Error("Source-estimated quantities must not be published as precise values");
  }
  if (
    fixture.tradeObservations.some(
      (row) => row.quantityDataStatus === "observed" && typeof row.quantity !== "number"
    )
  ) {
    throw new Error("Observed quantities must retain their numeric source value");
  }
  if (
    fixture.macroIndicators
      .filter((row) => row.indicator === "merchandise_trade_balance_current_usd")
      .some(
        (row) =>
          !row.notes?.includes("Input observation IDs:") ||
          !row.notes.includes("No additional rounding is applied")
      )
  ) {
    throw new Error("Trade-balance observations must retain input IDs and rounding provenance");
  }
  const returnedReporters = new Set((comtradeRaw.payload?.data ?? []).map((row) => `${row.reporterCode}:${row.flowCode}`));
  const codRows = fixture.tradeObservations.filter((row) => row.reporterEntityId === "country-cd");
  if (returnedReporters.has("180:M") || returnedReporters.has("180:X")) {
    throw new Error("Expected the current Comtrade snapshot to have no DRC rows; review the fixture boundary");
  }
  if (codRows.length !== 0) throw new Error("Missing DRC Comtrade rows must not be fabricated as zero/unknown facts");

  const gapStatuses = new Set(fixture.evidenceGaps.map((gap) => gap.status));
  if (
    fixture.evidenceGaps.length === 0 ||
    !["open", "partial", "closed", "not_publicly_observable"].every((status) =>
      gapStatuses.has(status)
    )
  ) {
    throw new Error("Evidence gap registry must contain all four review states");
  }
  const evidenceScopeIds = new Set(
    fixture.evidence.filter((record) => record.scope).map((record) => record.id)
  );
  for (const node of fixture.storyGraph.nodes.filter(
    (record) => record.evidenceLevel === "role_supported"
  )) {
    if (!node.evidenceIds.some((id) => evidenceScopeIds.has(id))) {
      throw new Error(`Role-supported node requires structured evidence scope: ${node.id}`);
    }
  }
}

async function main() {
  const [
    sample,
    routeContentRaw,
    wdiRaw,
    comtradeRaw,
    bilateralRaw,
    materialRaw,
    industryRoleContent,
    gapRegistry
  ] = await Promise.all([
    readJson(SAMPLE_PATH),
    readFile(ROUTE_CONTENT_PATH, "utf8"),
    readJson(resolve(RAW_DIR, "world-bank-wdi-2023.json")),
    readJson(resolve(RAW_DIR, "un-comtrade-hs2022-851713-2023.json")),
    readJson(BILATERAL_SNAPSHOT_PATH),
    readJson(MATERIAL_SNAPSHOT_PATH),
    readJson(INDUSTRY_ROLE_EVIDENCE_PATH),
    readJson(EVIDENCE_GAP_REGISTRY_PATH)
  ]);
  const routeContent = JSON.parse(routeContentRaw);
  if (wdiRaw.sourceId !== SOURCE_IDS.wdi || comtradeRaw.sourceId !== SOURCE_IDS.comtrade) {
    throw new Error("Raw snapshot source IDs do not match the published build configuration");
  }
  if (
    bilateralRaw.sourceId !== SOURCE_IDS.comtrade ||
    industryRoleContent.productId !== sample.productId ||
    gapRegistry.productId !== sample.productId
  ) {
    throw new Error("Published evidence inputs do not match the smartphone build scope");
  }
  const fixture = buildFixture(
    sample,
    routeContent,
    wdiRaw,
    comtradeRaw,
    bilateralRaw,
    materialRaw,
    industryRoleContent,
    gapRegistry
  );
  assertBuildInvariants(fixture, comtradeRaw);
  await mkdir(OUTPUT_DIR, { recursive: true });
  const serialized = `${JSON.stringify(fixture, null, 2)}\n`;
  await writeFile(OUTPUT_PATH, serialized, "utf8");
  const manifest = {
    schemaVersion: "fixture-manifest.v1",
    fixtures: [{ productId: fixture.productId, path: "smartphone/fixture.json" }],
    datasetVersion: DATASET_VERSION,
    generatedAt: "2026-08-25",
    fixtureSha256: sha256(serialized),
    routeContentVersion: routeContent.contentVersion.version,
    routeContentSha256: sha256(routeContentRaw),
    contentSources: [
      "../../content/routes/generic-smartphone-2023.json",
      "../../content/evidence/industry-roles-2023.json",
      "../../content/evidence-gaps/generic-smartphone-2023.json"
    ],
    sourceSnapshots: [
      "raw/world-bank-wdi-2023.json",
      "raw/un-comtrade-hs2022-851713-2023.json",
      "raw/un-comtrade-hs2022-851713-bilateral-2023.json"
      ,"raw/un-comtrade-hs2022-materials-2023.json"
    ],
    notes: [
      "Numeric observations are generated from immutable local raw snapshots; reviewed route topology and evidence bindings come from the versioned content source. No runtime API calls are made.",
      "The published fixture intentionally omits countries/flows absent from the Comtrade response rather than filling zero.",
      "The fixture now contains specific bilateral HS 851713 customs observations, kept separate from world totals and from the representative supply-chain edges.",
      "All current supply-chain edges remain representative and quantity-free because customs trade does not prove assembly, consumption or entry into this curated route.",
      "Evidence gaps are versioned content and cover every current node and edge."
    ]
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`built ${OUTPUT_PATH}`);
  console.log(`wrote ${fixture.tradeObservations.length} Comtrade observations and ${fixture.macroIndicators.length} macro observations`);
  console.log(`fixture sha256 ${manifest.fixtureSha256}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
