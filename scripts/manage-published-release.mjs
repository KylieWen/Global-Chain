#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const published = resolve(root, "data/published");
const activePath = resolve(published, "active-manifest.json");
const releasesRoot = resolve(published, "releases/generic-smartphone");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const active = async () => readJson(activePath);
const versions = async () => {
  if (!existsSync(releasesRoot)) return [];
  const { readdir } = await import("node:fs/promises");
  return (await readdir(releasesRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
};
const command = process.argv[2];

if (command === "list") {
  console.log(JSON.stringify({ activeDatasetVersion: (await active()).activeDatasetVersion, releases: await versions() }, null, 2));
} else if (command === "activate") {
  const version = process.argv[3];
  if (!version || !(await versions()).includes(version)) throw new Error(`Unknown published release: ${version}`);
  const releaseManifest = await readJson(resolve(releasesRoot, version, "manifest.json"));
  const next = { ...releaseManifest, fixtures: [{ productId: "generic-smartphone", path: `releases/generic-smartphone/${version}/fixture.json` }], activeDatasetVersion: version, activeManifest: true };
  await writeFile(activePath, `${JSON.stringify(next, null, 2)}\n`);
  await writeFile(resolve(published, "manifest.json"), `${JSON.stringify(next, null, 2)}\n`);
  console.log(`activated ${version}`);
} else if (command === "rollback") {
  const target = process.argv[3];
  const all = await versions();
  const current = (await active()).activeDatasetVersion;
  const candidates = all.filter((version) => version !== current);
  const version = target || candidates.at(-1);
  if (!version) throw new Error("No previous release is available for rollback");
  if (!all.includes(version)) throw new Error(`Unknown published release: ${version}`);
  const releaseManifest = await readJson(resolve(releasesRoot, version, "manifest.json"));
  const next = { ...releaseManifest, fixtures: [{ productId: "generic-smartphone", path: `releases/generic-smartphone/${version}/fixture.json` }], activeDatasetVersion: version, activeManifest: true };
  await writeFile(activePath, `${JSON.stringify(next, null, 2)}\n`);
  await writeFile(resolve(published, "manifest.json"), `${JSON.stringify(next, null, 2)}\n`);
  console.log(`rolled back from ${current} to ${version}`);
} else if (command === "verify") {
  const manifest = await active();
  const fixturePath = resolve(published, manifest.fixtures[0].path);
  const fixture = await readJson(fixturePath);
  if (fixture.datasetVersion.version !== manifest.activeDatasetVersion) throw new Error("Active manifest and fixture version differ");
  const fixtureHash = createHash("sha256").update(await readFile(fixturePath, "utf8")).digest("hex");
  if (manifest.fixtureSha256 && manifest.fixtureSha256 !== fixtureHash) throw new Error("Active manifest fixture hash does not match fixture bytes");
  console.log(JSON.stringify({ status: "ok", activeDatasetVersion: manifest.activeDatasetVersion, fixture: fixturePath, fixtureSha256: fixtureHash, productId: fixture.productId }, null, 2));
} else {
  console.error("Usage: node scripts/manage-published-release.mjs <list|activate VERSION|rollback [VERSION]|verify>");
  process.exitCode = 1;
}
