#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const out = resolve(root, "data/published/raw/un-comtrade-hs2022-materials-2023.json");
const replaceExisting = process.argv.includes("--replace");
const specs = [
  ["copper", "7403", "copper, refined/unrefined (aggregate)"],
  ["aluminum", "7601", "unwrought aluminum (aggregate)"],
  ["lithium", "283691", "lithium carbonate"],
  ["cobalt", "8105", "cobalt and articles thereof (aggregate)"],
  ["nickel", "7502", "unwrought nickel (aggregate)"],
  ["graphite", "250410", "natural graphite"]
];
const responses = [];
for (const partnerCode of [0, 842]) {
  const url = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=156&partnerCode=${partnerCode}&cmdCode=${specs.map(([, code]) => code).join(",")}&flowCode=M,X&period=2023&motCode=0&partner2Code=0&customsCode=C00&maxRecords=500`;
  await new Promise((resolve) => setTimeout(resolve, 1400));
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  responses.push({ partnerCode, url, retrievedAt: new Date().toISOString(), responseSha256: createHash("sha256").update(text).digest("hex"), payload: JSON.parse(text) });
}
await mkdir(resolve(root, "data/published/raw"), { recursive: true });
const snapshot = { schemaVersion: "material-comtrade-snapshot.v1", source: "UN Comtrade Preview API", hsVersion: "2022", period: "2023", license: "UN Comtrade License Agreement and Policy on Use and Re-dissemination apply", responses };
if (await import("node:fs/promises").then(({ access, readFile }) => access(out).then(async () => {
  const existing = JSON.parse(await readFile(out, "utf8"));
  const oldHashes = (existing.responses ?? []).map((response) => response.responseSha256);
  const newHashes = responses.map((response) => response.responseSha256);
  if (JSON.stringify(oldHashes) !== JSON.stringify(newHashes) && !replaceExisting) throw new Error(`Snapshot changed: ${out}. Use --replace intentionally.`);
  return JSON.stringify(oldHashes) === JSON.stringify(newHashes);
  }).catch((error) => error.code === "ENOENT" ? false : Promise.reject(error)))) {
  console.log(`unchanged ${out}`);
} else {
  await writeFile(out, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`wrote ${out}`);
}
console.log(`wrote ${out}`);
