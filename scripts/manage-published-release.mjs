#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { activatePublishedRelease, listPublishedReleases, verifyPublishedManifest } from "./lib/published-releases.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const published = resolve(root, "data/published");
const active = async () => JSON.parse(await readFile(resolve(published, "active-manifest.json"), "utf8"));

async function main() {
  const [command, ...args] = process.argv.slice(2);
  let productId;
  const positional = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--") continue;
    if (args[index] === "--product") {
      if (productId || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("--product requires one product ID");
      productId = args[++index];
    } else if (args[index].startsWith("--")) throw new Error(`Unknown option: ${args[index]}`);
    else positional.push(args[index]);
  }
  if (positional.length > 1 || ((command === "list" || command === "verify") && positional.length)) throw new Error("Unexpected release argument");
  if (command === "list") {
    const manifest = await active();
    const releases = await listPublishedReleases(published, productId);
    console.log(JSON.stringify({ activeDatasetVersion: manifest.activeDatasetVersion, activeProducts: manifest.fixtures, releases: releases.map((release) => release.datasetVersion), productReleases: releases }, null, 2));
  } else if (command === "activate" || command === "rollback") {
    const result = await activatePublishedRelease(published, { productId, datasetVersion: positional[0], rollback: command === "rollback" });
    console.log(`${command === "rollback" ? "rolled back" : "activated"} ${result.selected.productId}: ${result.previousVersion ?? "not active"} -> ${result.selected.datasetVersion}`);
  } else if (command === "verify") {
    const manifest = await active();
    const releases = await verifyPublishedManifest(published, manifest);
    console.log(JSON.stringify({ status: "ok", activeDatasetVersion: manifest.activeDatasetVersion, products: releases.map(({ productId, datasetVersion, fixturePath, fixtureSha256 }) => ({ productId, datasetVersion, fixture: fixturePath, fixtureSha256 })) }, null, 2));
  } else throw new Error("Usage: node scripts/manage-published-release.mjs <list|activate VERSION|rollback [VERSION]|verify> [--product PRODUCT_ID]");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
