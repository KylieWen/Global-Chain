#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = resolve(root, "data/published/raw/un-comtrade-hs2022-material-intermediate-2023.json");
const queryCodes = ["741011", "741012", "760711", "760719", "382499", "380110", "380190"];
const queries = [
  { id: "chn-kor-intermediate", reporterCode: 156, partnerCode: 410, label: "China ↔ Korea intermediate material candidates" },
  { id: "chn-usa-intermediate", reporterCode: 156, partnerCode: 842, label: "China ↔ USA statistical area intermediate material candidates" }
];
const responses = [];
for (const query of queries) {
  const url = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=${query.reporterCode}&partnerCode=${query.partnerCode}&cmdCode=${queryCodes.join(",")}&flowCode=M,X&period=2023&motCode=0&partner2Code=0&customsCode=C00&maxRecords=500`;
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
  let response = await fetch(url, { headers: { accept: "application/json" } });
  let text = await response.text();
  if (response.status === 429) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2200));
    response = await fetch(url, { headers: { accept: "application/json" } });
    text = await response.text();
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${query.id}: ${text.slice(0, 200)}`);
  responses.push({ ...query, classificationCodes: queryCodes, url, retrievedAt: new Date().toISOString(), httpStatus: response.status, responseSha256: createHash("sha256").update(text).digest("hex"), payload: JSON.parse(text) });
}
await mkdir(resolve(root, "data/published/raw"), { recursive: true });
await writeFile(output, JSON.stringify({ schemaVersion: "material-intermediate-snapshot.v1", source: "UN Comtrade Preview API", hsVersion: "2022", period: "2023", license: "UN Comtrade License Agreement and Policy on Use and Re-dissemination apply", transformation: "scripts/build-published-smartphone.mjs intermediate classification normalization", responses }, null, 2) + "\n");
console.log(`wrote ${output}`);
