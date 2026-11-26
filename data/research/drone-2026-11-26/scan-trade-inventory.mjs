// Read-only inventory of local Comtrade trade snapshots. Does not collect network data.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, relative, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const roots = ["data/raw", "data/published/raw"];
const out = [];

function walk(relDir) {
  const abs = join(root, relDir);
  if (!existsSync(abs)) return;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const rel = join(relDir, entry.name);
    if (entry.isDirectory()) walk(rel);
    else if (entry.name.endsWith(".json")) {
      const text = readFileSync(join(root, rel), "utf8");
      if (!text.includes("cmdCode") && !text.includes("primaryValue")) continue;
      const codes = [...new Set([...text.matchAll(/"cmdCode"\s*:\s*"?(\d+)"?/g)].map((m) => m[1]))];
      const reporters = [...new Set([...text.matchAll(/"reporterCode"\s*:\s*(\d+)/g)].map((m) => m[1]))];
      const partners = [...new Set([...text.matchAll(/"partnerCode"\s*:\s*(\d+)/g)].map((m) => m[1]))];
      const periods = [...new Set([...text.matchAll(/"period"\s*:\s*"?([0-9-]+)"?/g)].map((m) => m[1]))];
      const flows = [...new Set([...text.matchAll(/"flowCode"\s*:\s*"([MX])"/g)].map((m) => m[1]))];
      const observationCount = (text.match(/"primaryValue"/g) || []).length;
      out.push({ file: rel.split("\\").join("/"), codes, reporters, partners, periods, flows, observationCount });
    }
  }
}

for (const r of roots) walk(r);
const droneRelated = out.filter((x) => x.codes.some((c) => c.startsWith("8806") || c.startsWith("8802") || c.startsWith("8801")));
const allCodes = [...new Set(out.flatMap((x) => x.codes))].sort();
const inventory = {
  scannedAt: "2026-11-25T15:30:00Z",
  note: "Read-only inventory of local Comtrade snapshots; not new network collection. Missing snapshots are not zero trade.",
  droneRelated,
  allCodes,
  files: out
};
const target = resolve(root, "data/research/drone-2026-11-26/extracts/trade-snapshot-inventory.json");
writeFileSync(target, JSON.stringify(inventory, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ tradeFiles: out.length, droneRelated: droneRelated.length, allCodes }, null, 2));
