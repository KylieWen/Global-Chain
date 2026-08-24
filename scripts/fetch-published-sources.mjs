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

async function main() {
  await mkdir(RAW_DIR, { recursive: true });

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

  const runMetadata = {
    schemaVersion: "published-source-run.v1",
    retrievedAt: RETRIEVED_AT,
    year: YEAR,
    countries,
    indicators,
    classification: { system: "HS", version: "2022", code: "851713" },
    files: [
      "world-bank-wdi-2023.json",
      "un-comtrade-hs2022-851713-2023.json"
    ],
    notes: [
      "Raw snapshots are immutable unless --replace is explicitly supplied.",
      "The build step consumes these snapshots and never calls the source APIs at runtime."
    ]
  };
  const stableRunMetadata = { ...runMetadata };
  delete stableRunMetadata.retrievedAt;
  await saveSnapshot(resolve(RAW_DIR, "manifest.json"), {
    ...runMetadata,
    payloadSha256: sha256(JSON.stringify(stableRunMetadata))
  }, {
    equivalent: (existing) => {
      const previous = { ...existing };
      delete previous.retrievedAt;
      delete previous.payloadSha256;
      const current = { ...runMetadata };
      delete current.retrievedAt;
      return JSON.stringify(previous) === JSON.stringify(current);
    }
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
