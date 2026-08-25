#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = resolve(root, "data/published/raw/un-comtrade-hs2022-material-role-pairs-2023.json");
const replaceExisting = process.argv.includes("--replace");
const pairs = [
  { id: "aus-chn-lithium", reporterCode: 36, partnerCode: 156, materialItemId: "lithium", cmdCode: "283691", label: "Australia → China lithium carbonate" },
  { id: "cod-chn-cobalt", reporterCode: 180, partnerCode: 156, materialItemId: "cobalt", cmdCode: "8105", label: "DRC → China cobalt aggregate" },
  { id: "idn-chn-nickel", reporterCode: 360, partnerCode: 156, materialItemId: "nickel", cmdCode: "7502", label: "Indonesia → China unwrought nickel aggregate" },
  { id: "chl-chn-copper", reporterCode: 152, partnerCode: 156, materialItemId: "copper", cmdCode: "7403", label: "Chile → China copper aggregate" },
  { id: "aus-chn-aluminum", reporterCode: 36, partnerCode: 156, materialItemId: "aluminum", cmdCode: "7601", label: "Australia → China unwrought aluminum aggregate" },
  { id: "chn-kor-graphite", reporterCode: 156, partnerCode: 410, materialItemId: "graphite", cmdCode: "250410", label: "China → Korea natural graphite" }
];
const responses = [];
for (const pair of pairs) {
  const url = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=${pair.reporterCode}&partnerCode=${pair.partnerCode}&cmdCode=${pair.cmdCode}&flowCode=M,X&period=2023&motCode=0&partner2Code=0&customsCode=C00&maxRecords=500`;
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1400));
  let response = await fetch(url, { headers: { accept: "application/json" } });
  let text = await response.text();
  if (response.status === 429) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2200));
    response = await fetch(url, { headers: { accept: "application/json" } });
    text = await response.text();
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${pair.id}: ${text.slice(0, 200)}`);
  responses.push({ ...pair, url, retrievedAt: new Date().toISOString(), httpStatus: response.status, responseSha256: createHash("sha256").update(text).digest("hex"), payload: JSON.parse(text) });
}
await mkdir(resolve(root, "data/published/raw"), { recursive: true });
const snapshot = { schemaVersion: "material-role-pairs-snapshot.v1", source: "UN Comtrade Preview API", hsVersion: "2022", period: "2023", license: "UN Comtrade License Agreement and Policy on Use and Re-dissemination apply", transformation: "scripts/build-published-smartphone.mjs material role-pair normalization", responses };
const { access, readFile } = await import("node:fs/promises");
let unchanged = false;
try { const existing = JSON.parse(await readFile(output, "utf8")); unchanged = JSON.stringify((existing.responses ?? []).map((x) => x.responseSha256)) === JSON.stringify(responses.map((x) => x.responseSha256)); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (!unchanged && await access(output).then(() => true).catch(() => false) && !replaceExisting) throw new Error(`Snapshot changed: ${output}. Use --replace intentionally.`);
if (unchanged) console.log(`unchanged ${output}`); else { await writeFile(output, JSON.stringify(snapshot, null, 2) + "\n"); console.log(`wrote ${output}`); }
console.log(`wrote ${output}`);
