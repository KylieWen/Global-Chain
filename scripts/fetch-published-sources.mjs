#!/usr/bin/env node

/**
 * Fetch the fixed 2023 source snapshots used by the first published
 * smartphone fixture.
 *
 * The script deliberately writes snapshots, not a runtime data client.  A
 * snapshot is immutable by default: a second run with a changed upstream
 * response fails and asks for an explicit `--replace`.  This makes a source
 * revision visible in version control instead of silently changing the data
 * behind a published fixture.
 */

import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = resolve(ROOT, "data/published/raw");
const YEAR = "2023";
const RETRIEVED_AT = new Date().toISOString();
const replaceExisting = process.argv.includes("--replace");
const bilateralOnly = process.argv.includes("--bilateral-only");

const countries = [
  { iso3: "AUS", iso2: "AU", name: "Australia", reporterCode: 36 },
  { iso3: "COD", iso2: "CD", name: "Democratic Republic of the Congo", reporterCode: 180 },
  { iso3: "CHL", iso2: "CL", name: "Chile", reporterCode: 152 },
  { iso3: "CHN", iso2: "CN", name: "China", reporterCode: 156 },
  { iso3: "DEU", iso2: "DE", name: "Germany", reporterCode: 276 },
  { iso3: "IDN", iso2: "ID", name: "Indonesia", reporterCode: 360 },
  { iso3: "JPN", iso2: "JP", name: "Japan", reporterCode: 392 },
  { iso3: "KOR", iso2: "KR", name: "Republic of Korea", reporterCode: 410 },
  { iso3: "USA", iso2: "US", name: "United States of America", reporterCode: 842 }
];

const indicators = {
  merchandise_exports_current_usd: "TX.VAL.MRCH.CD.WT",
  merchandise_imports_current_usd: "TM.VAL.MRCH.CD.WT",
  official_reserves_including_gold_current_usd: "FI.RES.TOTL.CD"
};

const worldBankBase = "https://api.worldbank.org/v2";
const comtradeBase = "https://comtradeapi.un.org/public/v1/preview/C/A/HS";
const comtradeMetadataBase = "https://comtradeapi.un.org/public/v1/getMetadata/C/A/HS";
const comtradeMinimumIntervalMs = 1_100;

// UN Comtrade source-native codes are intentionally retained.  In
// particular, 842 is the current Comtrade reporter/statistical-area code for
// "USA, Puerto Rico and US Virgin Islands"; it must not be silently rewritten
// to ISO/M49 840.
const bilateralComtradePairs = [
  {
    id: "chn-usa-area",
    reporter: { code: 156, label: "China" },
    partner: {
      code: 842,
      label: "USA",
      scopeNote: "UN Comtrade partner area 842: USA, Puerto Rico and US Virgin Islands; not ISO/M49 code 840."
    }
  },
  {
    id: "usa-area-chn",
    reporter: {
      code: 842,
      label: "USA",
      scopeNote: "UN Comtrade reporter area 842: USA, Puerto Rico and US Virgin Islands; not ISO/M49 code 840."
    },
    partner: { code: 156, label: "China" }
  },
  {
    id: "chn-deu",
    reporter: { code: 156, label: "China" },
    partner: { code: 276, label: "Germany" }
  },
  {
    id: "deu-chn",
    reporter: { code: 276, label: "Germany" },
    partner: { code: 156, label: "China" }
  }
];

const bilateralMetadataReporters = [
  { code: 156, label: "China" },
  {
    code: 842,
    label: "USA",
    scopeNote: "UN Comtrade reporter area 842: USA, Puerto Rico and US Virgin Islands; not ISO/M49 code 840."
  },
  { code: 276, label: "Germany" }
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function fetchText(url, { attempts = 3, timeoutMs = 30_000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${url}: ${text.slice(0, 300)}`);
      }
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(500 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function fetchAuditableResponse(url, { attempts = 3, timeoutMs = 30_000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const requestedAt = new Date().toISOString();
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${url}: ${text.slice(0, 300)}`);
      }
      return {
        requestedAt,
        responseDate: response.headers.get("date"),
        httpStatus: response.status,
        responseSha256: sha256(text),
        text
      };
    } catch (error) {
      lastError = error;
      // Preview API fair-use guidance is one call per second.  Keep retries
      // above that interval too, especially after a transient 429.
      if (attempt < attempts) await sleep(1_500 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function parseJson(text, url) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function ensureWorldBankPayload(payload, url) {
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
    throw new Error(`Unexpected World Bank response shape from ${url}`);
  }
  return payload;
}

function ensureComtradePayload(payload, url) {
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error(`Unexpected UN Comtrade response shape from ${url}`);
  }
  return payload;
}

function assertBilateralComtradePayload(payload, pair, url) {
  const rows = ensureComtradePayload(payload, url).data;
  if (rows.length !== 2) {
    throw new Error(`Expected two M/X bilateral rows for ${pair.id}, received ${rows.length} from ${url}`);
  }
  const flows = new Set(rows.map((row) => row.flowCode));
  if (!flows.has("M") || !flows.has("X")) {
    throw new Error(`Expected both M and X bilateral rows for ${pair.id} from ${url}`);
  }
  for (const row of rows) {
    const checks = [
      row.typeCode === "C",
      row.freqCode === "A",
      Number(row.refYear) === Number(YEAR) && String(row.period) === YEAR,
      Number(row.reporterCode) === pair.reporter.code,
      Number(row.partnerCode) === pair.partner.code,
      Number(row.partnerCode) !== 0,
      Number(row.partner2Code) === 0,
      row.classificationSearchCode === "HS" && row.classificationCode === "H6",
      String(row.cmdCode) === "851713",
      row.customsCode === "C00",
      Number(row.motCode) === 0,
      row.flowCode === "M" || row.flowCode === "X"
    ];
    if (checks.some((check) => !check)) {
      throw new Error(`Unexpected bilateral row scope for ${pair.id}: ${JSON.stringify(row)}`);
    }
  }
  return payload;
}

async function saveSnapshot(filePath, snapshot, { equivalent } = {}) {
  await mkdir(dirname(filePath), { recursive: true });
  if (existsSync(filePath)) {
    const existingText = await readFile(filePath, "utf8");
    let existing;
    try {
      existing = JSON.parse(existingText);
    } catch {
      throw new Error(`Existing snapshot is not valid JSON: ${filePath}`);
    }
    if (existing.payloadSha256 === snapshot.payloadSha256 || (equivalent && equivalent(existing))) {
      console.log(`unchanged ${filePath}`);
      return;
    }
    if (!replaceExisting) {
      throw new Error(
        `Snapshot changed: ${filePath}. Use --replace only when intentionally publishing a new source revision.`
      );
    }
    console.warn(`replacing ${filePath} (--replace)`);
  }
  await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`saved ${filePath}`);
}

async function saveRunManifest(filePath, manifest) {
  await mkdir(dirname(filePath), { recursive: true });
  if (existsSync(filePath)) {
    const existing = parseJson(await readFile(filePath, "utf8"), filePath);
    const existingFiles = new Set(existing.files ?? []);
    const nextFiles = new Set(manifest.files ?? []);
    const onlyAddsBilateralSnapshot =
      [...existingFiles].every((file) => nextFiles.has(file)) &&
      [...nextFiles].every(
        (file) => existingFiles.has(file) || file === "un-comtrade-hs2022-851713-bilateral-2023.json"
      );
    if (!onlyAddsBilateralSnapshot && !replaceExisting) {
      throw new Error(
        `Run manifest changed outside the reviewed bilateral snapshot addition: ${filePath}. ` +
        "Use --replace only when intentionally publishing a new source revision."
      );
    }
  }
  await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`saved ${filePath}`);
}

function worldBankUrl(indicatorCode) {
  const countryPath = countries.map((country) => country.iso3).join(";");
  const url = new URL(`${worldBankBase}/country/${countryPath}/indicator/${indicatorCode}`);
  url.searchParams.set("date", YEAR);
  url.searchParams.set("format", "json");
  url.searchParams.set("per_page", "100");
  return url.toString();
}

function comtradeUrl() {
  const url = new URL(comtradeBase);
  url.searchParams.set("period", YEAR);
  url.searchParams.set("reporterCode", countries.map((country) => country.reporterCode).join(","));
  url.searchParams.set("cmdCode", "851713");
  url.searchParams.set("flowCode", "X,M");
  url.searchParams.set("partnerCode", "0");
  url.searchParams.set("partner2Code", "0");
  url.searchParams.set("customsCode", "C00");
  url.searchParams.set("motCode", "0");
  url.searchParams.set("maxRecords", "500");
  return url.toString();
}

function bilateralComtradeUrl(pair) {
  const url = new URL(comtradeBase);
  url.searchParams.set("period", YEAR);
  url.searchParams.set("reporterCode", String(pair.reporter.code));
  url.searchParams.set("cmdCode", "851713");
  url.searchParams.set("flowCode", "X,M");
  url.searchParams.set("partnerCode", String(pair.partner.code));
  url.searchParams.set("partner2Code", "0");
  url.searchParams.set("customsCode", "C00");
  url.searchParams.set("motCode", "0");
  url.searchParams.set("maxRecords", "500");
  return url.toString();
}

function comtradeMetadataUrl(reporter) {
  const url = new URL(comtradeMetadataBase);
  url.searchParams.set("period", YEAR);
  url.searchParams.set("reporterCode", String(reporter.code));
  return url.toString();
}

function canonicalComtradeDataHash(payload) {
  const rows = [...payload.data].sort((left, right) =>
    `${left.reporterCode}:${left.partnerCode}:${left.flowCode}`.localeCompare(
      `${right.reporterCode}:${right.partnerCode}:${right.flowCode}`
    )
  );
  return sha256(JSON.stringify(rows));
}

async function fetchSequentialComtradeRequests(requests) {
  const results = [];
  let previousRequestStartedAt = 0;
  for (const request of requests) {
    const waitMs = Math.max(0, comtradeMinimumIntervalMs - (Date.now() - previousRequestStartedAt));
    if (waitMs > 0) await sleep(waitMs);
    previousRequestStartedAt = Date.now();
    const response = await fetchAuditableResponse(request.url);
    results.push({ request, response });
  }
  return results;
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });

  if (!bilateralOnly) {
    const wdiResponses = {};
    for (const [key, indicatorCode] of Object.entries(indicators)) {
      const url = worldBankUrl(indicatorCode);
      const text = await fetchText(url);
      const payload = ensureWorldBankPayload(parseJson(text, url), url);
      wdiResponses[key] = {
        indicatorCode,
        request: { method: "GET", url },
        responseSha256: sha256(text),
        recordCount: payload[1].length,
        payload
      };
      console.log(`fetched World Bank ${key}: ${payload[1].length} records`);
    }

    const wdiCanonicalPayload = JSON.stringify(
      Object.fromEntries(
        Object.entries(wdiResponses).map(([key, response]) => [key, response.payload])
      )
    );
    await saveSnapshot(resolve(RAW_DIR, "world-bank-wdi-2023.json"), {
      schemaVersion: "raw-source-bundle.v1",
      sourceId: "source-world-bank-wdi",
      fetchedAt: RETRIEVED_AT,
      payloadSha256: sha256(wdiCanonicalPayload),
      indicators: wdiResponses,
      notes:
        "World Bank World Development Indicators observations for 2023. Indicator publishers are WTO (merchandise trade) and IMF IFS (total reserves including gold)."
    });

    const comtradeRequestUrl = comtradeUrl();
    const comtradeText = await fetchText(comtradeRequestUrl);
    const comtradePayload = ensureComtradePayload(parseJson(comtradeText, comtradeRequestUrl), comtradeRequestUrl);
    await saveSnapshot(resolve(RAW_DIR, "un-comtrade-hs2022-851713-2023.json"), {
      schemaVersion: "raw-source-snapshot.v1",
      sourceId: "source-un-comtrade",
      fetchedAt: RETRIEVED_AT,
      payloadSha256: sha256(comtradeText),
      request: { method: "GET", url: comtradeRequestUrl },
      recordCount: comtradePayload.data.length,
      payload: comtradePayload,
      notes:
        "UN Comtrade Preview API, annual customs trade, HS 2022 code 851713, partner world total. Missing reporter rows are not interpreted as zero."
    }, {
      // Comtrade's elapsedTime and a few transport metadata fields can vary
      // between identical requests. Compare the returned observations when an
      // older snapshot uses a different hashing convention.
      equivalent: (existing) =>
        JSON.stringify(existing?.payload?.data ?? []) === JSON.stringify(comtradePayload.data)
    });
  }

  const bilateralRequests = bilateralComtradePairs.map((pair) => ({
    kind: "trade",
    id: pair.id,
    pair,
    url: bilateralComtradeUrl(pair)
  }));
  const metadataRequests = bilateralMetadataReporters.map((reporter) => ({
    kind: "metadata",
    id: `metadata-${reporter.code}`,
    reporter,
    url: comtradeMetadataUrl(reporter)
  }));
  const bilateralFetches = await fetchSequentialComtradeRequests([
    ...bilateralRequests,
    ...metadataRequests
  ]);
  const bilateralResponses = [];
  const metadataResponses = [];
  for (const { request, response } of bilateralFetches) {
    const payload = parseJson(response.text, request.url);
    if (request.kind === "trade") {
      assertBilateralComtradePayload(payload, request.pair, request.url);
      bilateralResponses.push({
        pairId: request.id,
        reporter: request.pair.reporter,
        partner: request.pair.partner,
        request: {
          method: "GET",
          url: request.url,
          parameters: {
            period: YEAR,
            reporterCode: request.pair.reporter.code,
            cmdCode: "851713",
            flowCode: ["X", "M"],
            partnerCode: request.pair.partner.code,
            partner2Code: 0,
            customsCode: "C00",
            motCode: 0,
            maxRecords: 500
          }
        },
        requestedAt: response.requestedAt,
        responseDate: response.responseDate,
        httpStatus: response.httpStatus,
        rawResponseSha256: response.responseSha256,
        canonicalDataSha256: canonicalComtradeDataHash(payload),
        recordCount: payload.data.length,
        payload
      });
    } else {
      ensureComtradePayload(payload, request.url);
      if (
        payload.data.length !== 1 ||
        Number(payload.data[0]?.reporterCode) !== request.reporter.code ||
        Number(payload.data[0]?.period) !== Number(YEAR)
      ) {
        throw new Error(`Unexpected Comtrade metadata scope for reporter ${request.reporter.code}`);
      }
      metadataResponses.push({
        reporter: request.reporter,
        request: {
          method: "GET",
          url: request.url,
          parameters: { period: YEAR, reporterCode: request.reporter.code }
        },
        requestedAt: response.requestedAt,
        responseDate: response.responseDate,
        httpStatus: response.httpStatus,
        rawResponseSha256: response.responseSha256,
        canonicalDataSha256: canonicalComtradeDataHash(payload),
        recordCount: payload.data.length,
        payload
      });
    }
  }

  const bilateralCanonicalPayload = JSON.stringify({
    bilateral: bilateralResponses.map(({ canonicalDataSha256, pairId }) => ({
      pairId,
      canonicalDataSha256
    })),
    metadata: metadataResponses.map(({ canonicalDataSha256, reporter }) => ({
      reporterCode: reporter.code,
      canonicalDataSha256
    }))
  });
  await saveSnapshot(resolve(RAW_DIR, "un-comtrade-hs2022-851713-bilateral-2023.json"), {
    schemaVersion: "raw-source-bundle.v1",
    sourceId: "source-un-comtrade",
    sourceVersion: {
      classificationCode: "H6",
      classification: "HS 2022",
      period: YEAR,
      api: "UN Comtrade Public Preview API",
      apiDocumentation: "https://uncomtrade.org/docs/un-comtrade-api/",
      reporterMetadata: "latest available publication metadata at retrieval time; UN Comtrade may revise data"
    },
    fetchedAt: RETRIEVED_AT,
    payloadSha256: sha256(bilateralCanonicalPayload),
    requestPolicy: {
      sequential: true,
      minimumIntervalMs: comtradeMinimumIntervalMs,
      previewLimit: "500 records and one period/product per call",
      noSubscriptionKey: true
    },
    license: {
      agreement: "https://comtradeplus.un.org/LicenseAgreement",
      policy: "https://comtradeplus.un.org/PolicyOnUseAndRedissemination",
      disclaimer: "https://uncomtrade.org/docs/read-me-first-disclaimer/",
      redistributionFaq: "https://uncomtrade.org/docs/faqs-on-use-and-re-dissemination/",
      notice:
        "UN Comtrade data are not CC BY. Preserve attribution and query metadata. Public visualization is distinct from bulk/original-data redistribution; review current terms before redistributing raw responses or offering downloads."
    },
    scopeNotes: [
      "Each row is a source-reported reporter/partner observation. Mirror reports remain separate and are not reconciled or averaged.",
      "partnerCode=0 means world total and is not used in this bilateral bundle.",
      "Comtrade code 842 is a source-native USA statistical area that includes Puerto Rico and the US Virgin Islands; it is not silently normalized to ISO/M49 840.",
      "Imports and exports can differ because of CIF/FOB valuation, partner attribution, timing, classification and national trade systems.",
      "HS 2022 code 851713 establishes trade in the smartphone customs category; it does not identify a brand, factory, component chain, cost or profit."
    ],
    bilateralResponses,
    metadataResponses
  }, {
    equivalent: (existing) => existing?.payloadSha256 === sha256(bilateralCanonicalPayload)
  });

  let originalRunMetadata = null;
  if (bilateralOnly && existsSync(resolve(RAW_DIR, "manifest.json"))) {
    originalRunMetadata = parseJson(
      await readFile(resolve(RAW_DIR, "manifest.json"), "utf8"),
      resolve(RAW_DIR, "manifest.json")
    );
  }
  const bilateralSnapshotFile = "un-comtrade-hs2022-851713-bilateral-2023.json";
  const bilateralSnapshotPath = resolve(RAW_DIR, bilateralSnapshotFile);
  const bilateralSnapshotText = await readFile(bilateralSnapshotPath, "utf8");
  const bilateralSnapshot = parseJson(bilateralSnapshotText, bilateralSnapshotPath);
  const bilateralManifestNotes = [
    "Bilateral Comtrade observations retain source-native reporter and partner codes, mirror asymmetries, response hashes, and publication metadata.",
    "UN Comtrade reporter/partner code 842 is the USA statistical area including Puerto Rico and the US Virgin Islands; it is not ISO/M49 code 840."
  ];
  const originalFiles = originalRunMetadata?.files ?? [
    "world-bank-wdi-2023.json",
    "un-comtrade-hs2022-851713-2023.json"
  ];
  const originalNotes = originalRunMetadata?.notes ?? [
    "Raw snapshots are immutable unless --replace is explicitly supplied.",
    "The build step consumes these snapshots and never calls the source APIs at runtime."
  ];
  const runMetadata = {
    ...(originalRunMetadata ?? {}),
    schemaVersion: "published-source-run.v1",
    retrievedAt: originalRunMetadata?.retrievedAt ?? RETRIEVED_AT,
    bilateralRetrievedAt: bilateralSnapshot.fetchedAt,
    year: originalRunMetadata?.year ?? YEAR,
    countries: originalRunMetadata?.countries ?? countries,
    indicators: originalRunMetadata?.indicators ?? indicators,
    classification:
      originalRunMetadata?.classification ?? { system: "HS", version: "2022", code: "851713" },
    files: [...new Set([...originalFiles, bilateralSnapshotFile])],
    sourceSnapshots: {
      ...(originalRunMetadata?.sourceSnapshots ?? {}),
      bilateralComtrade: {
        file: bilateralSnapshotFile,
        sourceId: bilateralSnapshot.sourceId,
        sourceVersion: bilateralSnapshot.sourceVersion,
        fetchedAt: bilateralSnapshot.fetchedAt,
        payloadSha256: bilateralSnapshot.payloadSha256,
        fileSha256: sha256(bilateralSnapshotText),
        bilateralQueryCount: bilateralSnapshot.bilateralResponses.length,
        metadataQueryCount: bilateralSnapshot.metadataResponses.length,
        licenseAgreement: bilateralSnapshot.license.agreement,
        redistributionPolicy: bilateralSnapshot.license.policy
      }
    },
    notes: [...new Set([...originalNotes, ...bilateralManifestNotes])]
  };
  delete runMetadata.payloadSha256;
  const stableRunMetadata = { ...runMetadata };
  delete stableRunMetadata.retrievedAt;
  delete stableRunMetadata.bilateralRetrievedAt;
  await saveRunManifest(resolve(RAW_DIR, "manifest.json"), {
    ...runMetadata,
    payloadSha256: sha256(JSON.stringify(stableRunMetadata))
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
