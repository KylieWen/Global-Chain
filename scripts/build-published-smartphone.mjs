#!/usr/bin/env node

/**
 * Build the first published smartphone fixture from reviewed raw snapshots.
 *
 * This script is intentionally a local, deterministic transformation. It
 * never calls a remote API; run fetch-published-sources.mjs first when a new
 * source batch is intentionally being prepared. The sample fixture supplies
 * the content shape and representative route, while all numeric observations
 * are read from data/published/raw.
 */

import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE_PATH = resolve(ROOT, "data/samples/smartphone/fixture.json");
const RAW_DIR = resolve(ROOT, "data/published/raw");
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
const DATASET_VERSION = "globe-chain-smartphone-2023.1";
const CONTENT_VERSION_ID = "content-smartphone-route-2023-1";
const SOURCE_IDS = {
  wdi: "source-world-bank-wdi",
  comtrade: "source-un-comtrade",
  m49: "source-un-m49",
  usgs: "source-usgs-mineral-commodities",
  iea: "source-iea-battery-supply-chain"
};

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

function sourceIds(...ids) {
  return [...new Set(ids)];
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

function makeMacroObservation({ id, entityId, indicator, value, method, sourceId, notes }) {
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

    records.push(
      makeMacroObservation({
        id: `macro-${iso3.toLowerCase()}-merchandise-exports`,
        entityId: country.id,
        indicator: "merchandise_exports_current_usd",
        value: exportsValue,
        method: "official",
        sourceId: SOURCE_IDS.wdi,
        notes: `${commonNote} Indicator TX.VAL.MRCH.CD.WT.`
      }),
      makeMacroObservation({
        id: `macro-${iso3.toLowerCase()}-merchandise-imports`,
        entityId: country.id,
        indicator: "merchandise_imports_current_usd",
        value: importsValue,
        method: "official",
        sourceId: SOURCE_IDS.wdi,
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
        notes:
          `Derived as merchandise exports minus merchandise imports for ${YEAR}; inputs are the same WDI snapshot (${wdiVersion ?? "version not provided"}). Positive values indicate a surplus; this is not profit or domestic value added.`
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
  const estimationFlag = Number(row.legacyEstimationFlag ?? 0);
  const quantityEstimated = row.isQtyEstimated === true;
  const quantity = estimationFlag === 0 && !quantityEstimated && typeof row.qty === "number" && Number.isFinite(row.qty)
    ? row.qty
    : null;
  const dataStatus = estimationFlag !== 0 || quantityEstimated ? "estimated" : "observed";
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
    qtyUnitCode: row.qtyUnitCode ?? null,
    isReported: row.isReported ?? null,
    isAggregate: row.isAggregate ?? null,
    note: "A missing reporter/flow row is not interpreted as zero."
  };
  return {
    id,
    reporterEntityId: reporter.id,
    // partnerCode=0 is the Comtrade world total, not one of the nine local
    // country entities, so it is represented as null in the domain contract.
    partnerEntityId: null,
    direction,
    classificationSystem: "HS",
    classificationVersion: "2022",
    classificationCode: "851713",
    itemId: "generic-smartphone",
    period: period(),
    value: amount,
    quantity,
    currency: amount === null ? null : "USD",
    unit: quantity === null ? null : "items",
    statisticalConcept: "customs",
    sourceId: SOURCE_IDS.comtrade,
    datasetVersionId: DATASET_ID,
    method: "official",
    dataStatus: amount === null ? "unknown" : dataStatus,
    qualityNote: JSON.stringify(quality)
  };
}

function buildTradeObservations(comtradeRaw) {
  const byId = new Map();
  for (const row of parseComtradeRows(comtradeRaw)) {
    const reporter = [...countryByIso3.values()].find((country) =>
      Number(country.reporterCode ?? country.m49) === Number(row.reporterCode)
    );
    if (!reporter || !["M", "X"].includes(row.flowCode)) continue;
    const observation = makeTradeObservation(row, reporter);
    // A preview response should contain at most one world-total row per
    // reporter/flow. Keep deterministic first-seen behavior if upstream ever
    // returns duplicates.
    if (!byId.has(observation.id)) byId.set(observation.id, observation);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function makeSourceAndEvidence(wdiRaw, comtradeRaw) {
  const wdiRetrieved = wdiRaw.fetchedAt ?? "2026-08-25";
  const comtradeRetrieved = comtradeRaw.fetchedAt ?? "2026-08-25";
  const comtradeUrl = comtradeRaw.request?.url ?? "https://comtradeapi.un.org/public/v1/preview/C/A/HS";
  const wdiLastUpdated = wdiRaw.indicators?.merchandise_exports_current_usd?.payload?.[0]?.lastupdated ?? null;
  const sources = [
    sourceDefinition(wdiRaw, SOURCE_IDS.wdi, {
      name: "World Development Indicators",
      publisher: "World Bank",
      url: "https://data.worldbank.org/indicator/TX.VAL.MRCH.CD.WT",
      license: "CC BY 4.0 (World Bank public license; indicator-specific terms apply)",
      publishedAt: wdiLastUpdated,
      notes:
        "WDI indicators TX.VAL.MRCH.CD.WT, TM.VAL.MRCH.CD.WT and FI.RES.TOTL.CD. Underlying publishers shown by WDI include WTO for merchandise trade and IMF International Financial Statistics for reserves. API snapshot and hash are in data/published/raw/world-bank-wdi-2023.json."
    }, `WDI-${wdiLastUpdated ?? YEAR}`),
    sourceDefinition(comtradeRaw, SOURCE_IDS.comtrade, {
      name: "UN Comtrade Public API",
      publisher: "United Nations Statistics Division",
      url: comtradeUrl,
      license: "UN Comtrade License Agreement and Policy on Use and Re-dissemination; not CC BY",
      publishedAt: null,
      notes:
        `HS 2022 code 851713, world-total partner, annual customs observations for ${YEAR}. Preserve UN attribution and comply with the current terms at https://comtradeplus.un.org/LicenseAgreement and https://comtradeplus.un.org/PolicyOnUseAndRedissemination. Snapshot retrieved ${comtradeRetrieved}; primaryValue and quality flags are retained in the fixture.`
    }, `un-comtrade-hs2022-851713-${YEAR}`),
    {
      id: SOURCE_IDS.m49,
      name: "UN M49 geographic area codes",
      publisher: "United Nations Statistics Division",
      url: "https://unstats.un.org/unsd/methodology/m49/",
      license: "United Nations terms of use; reference mapping only",
      publishedAt: null,
      retrievedAt: "2026-08-25",
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
      retrievedAt: "2026-08-25",
      datasetVersion: "MCS-2024",
      notes:
        "Used only as background evidence for representative mineral roles. It does not prove a specific smartphone batch, company, bilateral shipment or unique route."
    },
    {
      id: SOURCE_IDS.iea,
      name: "Global supply chains of EV batteries",
      publisher: "International Energy Agency",
      url: "https://www.iea.org/reports/global-supply-chains-of-ev-batteries",
      license: "IEA terms of use; link-only citation in this fixture, not a CC BY relicense",
      publishedAt: "2022-07-01",
      retrievedAt: "2026-08-25",
      datasetVersion: "IEA-2022",
      notes:
        "Used as contextual evidence for concentration and battery-chain stages. The curated story remains representative and quantity-free."
    }
  ];
  const evidence = [
    {
      id: "evidence-usgs-mineral-roles",
      sourceId: SOURCE_IDS.usgs,
      locator: "Mineral Commodity Summaries 2024 PDF: Lithium, Cobalt, Nickel, Graphite, Copper and Aluminum commodity chapters",
      excerpt: null,
      notes: "Supports country/material role context only; no claim of a unique phone supply route."
    },
    {
      id: "evidence-iea-battery-chain",
      sourceId: SOURCE_IDS.iea,
      locator: "Executive summary and supply-chain concentration sections",
      excerpt: null,
      notes: "Supports the existence of multi-stage battery material, cell and module value-chain stages; no quantity is inferred."
    },
    {
      id: "evidence-un-m49-crosswalk",
      sourceId: SOURCE_IDS.m49,
      locator: "UN M49 country or area codes table; numeric codes 036, 152, 156, 180, 276, 360, 392, 410 and 840",
      excerpt: null,
      notes: "Supports the country/area dimension crosswalk used in this fixture."
    }
  ];
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
    sourceIds: sourceIds(SOURCE_IDS.usgs, SOURCE_IDS.iea),
    method: "curated",
    dataStatus: "observed",
    datasetVersionId: DATASET_ID,
    validPeriod: period()
  }));
  fixture.processStages = fixture.processStages.map((stage) => ({
    ...stage,
    sourceIds: sourceIds(SOURCE_IDS.usgs, SOURCE_IDS.iea),
    method: "curated",
    dataStatus: "observed",
    datasetVersionId: DATASET_ID
  }));
  fixture.productionActivities = fixture.productionActivities.map((activity) => ({
    ...activity,
    sourceIds: sourceIds(SOURCE_IDS.usgs, SOURCE_IDS.iea),
    method: "curated",
    dataStatus: "unknown",
    datasetVersionId: DATASET_ID,
    period: period(),
    notes: "代表性策展活动；不表示唯一工厂、批次、数量或企业利润。"
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
      sourceIds: smartphone ? [SOURCE_IDS.comtrade] : [SOURCE_IDS.usgs],
      method: "curated",
      dataStatus: "observed",
      datasetVersionId: DATASET_ID
    };
  });
}

function applyStoryMetadata(fixture) {
  const graph = fixture.storyGraph;
  graph.period = period();
  graph.datasetVersionId = DATASET_ID;
  graph.contentVersionId = CONTENT_VERSION_ID;
  graph.warnings = [
    "这是代表性供应链路径，不代表某一品牌、型号、企业、批次或唯一真实路线。",
    "路线关系没有数量值；未知数量保持为 unknown，不应解读为零。"
  ];
  graph.nodes = graph.nodes.map((node) => ({
    ...node,
    sourceIds: sourceIds(SOURCE_IDS.usgs, SOURCE_IDS.iea),
    method: "curated",
    dataStatus: "unknown",
    datasetVersionId: DATASET_ID,
    notes: "代表性角色节点，不表示唯一工厂或批次。"
  }));
  graph.flows = graph.flows.map((flow) => ({
    ...flow,
    period: period(),
    value: null,
    quantity: null,
    currency: null,
    unit: null,
    method: "curated",
    sourceIds: sourceIds(SOURCE_IDS.usgs, SOURCE_IDS.iea),
    confidence: null,
    dataStatus: "unknown",
    datasetVersionId: DATASET_ID,
    notes: "代表性供应链关系；不表示唯一来源、实时物流、贸易金额、成本或利润。"
  }));
  graph.steps = graph.steps.map((step) => ({
    ...step,
    evidenceIds: ["evidence-usgs-mineral-roles", "evidence-iea-battery-chain"],
    contentStatus: "published",
    contentVersionId: CONTENT_VERSION_ID
  }));
}

function buildFixture(sample, wdiRaw, comtradeRaw) {
  const fixture = clone(sample);
  fixture.schemaVersion = "product-fixture.v1";
  fixture.productId = "generic-smartphone";
  fixture.datasetVersion = {
    id: DATASET_ID,
    name: "GlobeChain 通用智能手机 2023 published 数据集",
    version: DATASET_VERSION,
    publishedAt: "2026-08-25",
    sourceIds: [SOURCE_IDS.wdi, SOURCE_IDS.comtrade, SOURCE_IDS.m49, SOURCE_IDS.usgs, SOURCE_IDS.iea],
    coverage: null,
    status: "published",
    notes:
      "2023 完整自然年；宏观指标来自 WDI，智能手机单品观察来自 UN Comtrade HS 2022 851713，路线为数量未知的代表性策展内容。"
  };
  const { sources, evidence } = makeSourceAndEvidence(wdiRaw, comtradeRaw);
  fixture.sources = sources;
  fixture.evidence = evidence;
  applyCatalogMetadata(fixture);
  applyStoryMetadata(fixture);
  fixture.tradeObservations = buildTradeObservations(comtradeRaw);
  fixture.macroIndicators = buildMacroIndicators(wdiRaw);
  fixture.warnings = [
    "本数据集使用 2023 完整自然年；不混合其他年份或财年。",
    "智能手机单品贸易为 HS 2022 六位码 851713、世界总计伙伴的海关观察；缺失国家/流向不填零。",
    "官方储备指标 FI.RES.TOTL.CD 包含黄金，不等同于狭义外汇储备。",
    "电池供应链是有来源的代表性策展路径，不代表唯一真实路线，也不提供成本、增加值或利润分配。",
    "Comtrade 估算和质量标记保存在 qualityNote，并影响 dataStatus；运行时不请求外部 API。"
  ];
  return fixture;
}

function assertBuildInvariants(fixture, comtradeRaw) {
  if (fixture.datasetVersion.status !== "published") throw new Error("Published fixture must have published dataset status");
  if (fixture.datasetVersion.id !== DATASET_ID) throw new Error("Unexpected dataset ID");
  if (fixture.storyGraph.datasetVersionId !== DATASET_ID) throw new Error("Story graph dataset mismatch");
  if (fixture.tradeObservations.some((row) => row.period.label !== YEAR)) throw new Error("Trade period mismatch");
  if (fixture.macroIndicators.some((row) => row.period.label !== YEAR)) throw new Error("Macro period mismatch");
  if (fixture.tradeObservations.some((row) => row.value === 0 && row.dataStatus !== "observed")) {
    throw new Error("Estimated/unknown trade observation cannot be represented as zero");
  }
  const returnedReporters = new Set((comtradeRaw.payload?.data ?? []).map((row) => `${row.reporterCode}:${row.flowCode}`));
  const codRows = fixture.tradeObservations.filter((row) => row.reporterEntityId === "country-cd");
  if (returnedReporters.has("180:M") || returnedReporters.has("180:X")) {
    throw new Error("Expected the current Comtrade snapshot to have no DRC rows; review the fixture boundary");
  }
  if (codRows.length !== 0) throw new Error("Missing DRC Comtrade rows must not be fabricated as zero/unknown facts");
}

async function main() {
  const [sample, wdiRaw, comtradeRaw] = await Promise.all([
    readJson(SAMPLE_PATH),
    readJson(resolve(RAW_DIR, "world-bank-wdi-2023.json")),
    readJson(resolve(RAW_DIR, "un-comtrade-hs2022-851713-2023.json"))
  ]);
  if (wdiRaw.sourceId !== SOURCE_IDS.wdi || comtradeRaw.sourceId !== SOURCE_IDS.comtrade) {
    throw new Error("Raw snapshot source IDs do not match the published build configuration");
  }
  const fixture = buildFixture(sample, wdiRaw, comtradeRaw);
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
    sourceSnapshots: [
      "raw/world-bank-wdi-2023.json",
      "raw/un-comtrade-hs2022-851713-2023.json"
    ],
    notes: [
      "Generated from immutable local raw snapshots; no runtime API calls.",
      "The published fixture intentionally omits countries/flows absent from the Comtrade response rather than filling zero."
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
