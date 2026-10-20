import { createHash } from "node:crypto";
import { readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep, win32 } from "node:path";

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const versionOrder = (left, right) => left.localeCompare(right, "en", { numeric: true });

function segment(value, label) {
  if (typeof value !== "string" || !SAFE_SEGMENT.test(value)) throw new Error(`Unsafe ${label}: ${value}`);
  return value;
}

function inside(root, path) {
  const child = relative(root, path);
  return child !== "" && !isAbsolute(child) && child !== ".." && !child.startsWith(`..${sep}`);
}

async function containedPath(root, entryPath) {
  if (typeof entryPath !== "string" || !entryPath || isAbsolute(entryPath) || win32.isAbsolute(entryPath) || entryPath.split(/[\\/]/).includes("..")) {
    throw new Error(`Release path must be relative and stay inside its directory: ${entryPath}`);
  }
  const path = resolve(root, entryPath);
  if (!inside(root, path) || !inside(await realpath(root), await realpath(path))) {
    throw new Error(`Release path resolves outside its directory: ${entryPath}`);
  }
  return path;
}

function fixtureEntries(manifest) {
  if (manifest.schemaVersion !== "fixture-manifest.v1" || !Array.isArray(manifest.fixtures) || !manifest.fixtures.length) {
    throw new Error("Invalid or empty published fixture manifest");
  }
  const ids = new Set();
  const paths = new Set();
  for (const entry of manifest.fixtures) {
    segment(entry.productId, "product ID");
    if (ids.has(entry.productId) || paths.has(entry.path)) throw new Error("Published manifest has duplicate product IDs or paths");
    ids.add(entry.productId);
    paths.add(entry.path);
  }
  return manifest.fixtures;
}

function assertNoMock(value) {
  if (!value || typeof value !== "object") return;
  if (value.method === "mock") throw new Error("Mock records cannot be activated as a published release");
  for (const child of Object.values(value)) assertNoMock(child);
}

/** Read a single immutable product release; never writes its files. */
export async function readPublishedRelease(publishedRoot, productId, datasetVersion) {
  segment(productId, "product ID");
  segment(datasetVersion, "dataset version");
  const releaseDirectory = await containedPath(publishedRoot, `releases/${productId}/${datasetVersion}`);
  const manifestPath = await containedPath(releaseDirectory, "manifest.json");
  const manifest = await readJson(manifestPath);
  const entries = fixtureEntries(manifest);
  if (entries.length !== 1 || entries[0].productId !== productId || manifest.datasetVersion !== datasetVersion ||
      manifest.release?.productId !== productId || manifest.release?.datasetVersion !== datasetVersion || manifest.release?.immutable !== true) {
    throw new Error(`Release identity or immutable metadata mismatch: ${productId}/${datasetVersion}`);
  }
  const fixturePath = await containedPath(releaseDirectory, entries[0].path);
  const bytes = await readFile(fixturePath);
  const fixture = JSON.parse(bytes.toString("utf8"));
  if (fixture.schemaVersion !== "product-fixture.v1" || fixture.productId !== productId || fixture.datasetVersion?.version !== datasetVersion) {
    throw new Error(`Release fixture identity or version mismatch: ${productId}/${datasetVersion}`);
  }
  if (fixture.datasetVersion.status !== "published") throw new Error(`Release is not published: ${productId}/${datasetVersion}`);
  assertNoMock(fixture);
  const fixtureSha256 = hash(bytes);
  if (!manifest.fixtureSha256 || manifest.fixtureSha256 !== fixtureSha256) throw new Error(`Release fixture hash mismatch: ${productId}/${datasetVersion}`);
  if (manifest.evidenceReview?.auditPath) {
    const auditPath = await containedPath(releaseDirectory, manifest.evidenceReview.auditPath);
    if (!manifest.evidenceReview.auditSha256 || hash(await readFile(auditPath)) !== manifest.evidenceReview.auditSha256) throw new Error(`Release evidence audit hash mismatch: ${productId}/${datasetVersion}`);
  }
  return { productId, datasetVersion, fixturePath, fixtureSha256, manifestPath, manifest };
}

/** Inventory across product directories. Unsafe directories and symlink escapes are rejected. */
export async function listPublishedReleases(publishedRoot, productId) {
  if (productId !== undefined) segment(productId, "product ID");
  const releasesRoot = resolve(publishedRoot, "releases");
  let products;
  try { products = await readdir(releasesRoot, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const result = [];
  for (const product of products) {
    if (!product.isDirectory() || !SAFE_SEGMENT.test(product.name) || (productId && product.name !== productId)) continue;
    const productDirectory = await containedPath(publishedRoot, `releases/${product.name}`);
    for (const release of await readdir(productDirectory, { withFileTypes: true })) {
      if (!release.isDirectory() || !SAFE_SEGMENT.test(release.name)) continue;
      const directory = await containedPath(productDirectory, release.name);
      try { await containedPath(directory, "manifest.json"); }
      catch (error) { if (error.code === "ENOENT") continue; throw error; }
      result.push({ productId: product.name, datasetVersion: release.name });
    }
  }
  return result.sort((left, right) => left.productId.localeCompare(right.productId) || versionOrder(left.datasetVersion, right.datasetVersion));
}

/** Validate every active entry against its own immutable manifest and hash. */
export async function verifyPublishedManifest(publishedRoot, manifest) {
  const results = [];
  for (const entry of fixtureEntries(manifest)) {
    const fixturePath = await containedPath(publishedRoot, entry.path);
    const parts = relative(publishedRoot, fixturePath).split(sep);
    if (parts[0] !== "releases" || parts[1] !== entry.productId || parts.length < 4) throw new Error(`Active fixture must belong to its product release directory: ${entry.productId}`);
    const release = await readPublishedRelease(publishedRoot, entry.productId, parts[2]);
    if (release.fixturePath !== fixturePath) throw new Error(`Active fixture differs from immutable manifest: ${entry.productId}`);
    const ownsLegacyMetadata = manifest.release?.productId === entry.productId || (manifest.fixtures.length === 1 && !manifest.release);
    const expectedVersions = [entry.datasetVersion, ...(ownsLegacyMetadata ? [manifest.activeDatasetVersion, manifest.datasetVersion] : [])];
    const expectedHashes = [entry.fixtureSha256, ...(ownsLegacyMetadata ? [manifest.fixtureSha256] : [])];
    if (expectedVersions.some((version) => version && version !== release.datasetVersion)) throw new Error(`Active fixture version mismatch: ${entry.productId}`);
    if (expectedHashes.some((value) => value && value !== release.fixtureSha256)) throw new Error(`Active fixture hash mismatch: ${entry.productId}`);
    results.push(release);
  }
  return results;
}

/** Prepare a reviewable manifest without mutating active or immutable data. */
export async function prepareReleaseActivation(publishedRoot, { datasetVersion, productId, rollback = false } = {}) {
  const current = await readJson(resolve(publishedRoot, "active-manifest.json"));
  const active = await verifyPublishedManifest(publishedRoot, current);
  const available = await listPublishedReleases(publishedRoot, productId);
  let selectedProduct = productId;
  if (datasetVersion !== undefined) {
    segment(datasetVersion, "dataset version");
    const matches = available.filter((release) => release.datasetVersion === datasetVersion);
    if (matches.length !== 1) throw new Error(matches.length ? "Ambiguous release version; specify --product PRODUCT_ID" : `Unknown published release: ${datasetVersion}`);
    selectedProduct = matches[0].productId;
  } else if (rollback) {
    if (!selectedProduct && active.length === 1) selectedProduct = active[0].productId;
    if (!selectedProduct) throw new Error("Multiple active products; specify --product PRODUCT_ID for rollback");
    const previous = active.find((release) => release.productId === selectedProduct);
    if (!previous) throw new Error(`Product is not active: ${selectedProduct}`);
    datasetVersion = available.filter((release) => release.productId === selectedProduct && versionOrder(release.datasetVersion, previous.datasetVersion) < 0).at(-1)?.datasetVersion;
    if (!datasetVersion) throw new Error(`No previous release is available for ${selectedProduct}`);
  } else throw new Error("A release version is required");
  const selected = await readPublishedRelease(publishedRoot, selectedProduct, datasetVersion);
  const fixtures = current.fixtures.map((entry) => {
    const release = entry.productId === selectedProduct ? selected : active.find((candidate) => candidate.productId === entry.productId);
    return { ...entry, productId: release.productId, path: relative(publishedRoot, release.fixturePath).split(sep).join("/"), datasetVersion: release.datasetVersion, fixtureSha256: release.fixtureSha256 };
  });
  if (!fixtures.some((entry) => entry.productId === selectedProduct)) fixtures.push({ productId: selected.productId, path: relative(publishedRoot, selected.fixturePath).split(sep).join("/"), datasetVersion: selected.datasetVersion, fixtureSha256: selected.fixtureSha256 });
  const next = { ...current, ...selected.manifest, fixtures, activeDatasetVersion: selected.datasetVersion, activeManifest: true };
  await verifyPublishedManifest(publishedRoot, next);
  return { manifest: next, selected, previousVersion: active.find((release) => release.productId === selectedProduct)?.datasetVersion };
}

/** Only active pointers are mutable. Preparation validates the whole catalog first. */
export async function activatePublishedRelease(publishedRoot, options) {
  const result = await prepareReleaseActivation(publishedRoot, options);
  const bytes = `${JSON.stringify(result.manifest, null, 2)}\n`;
  await writeFile(resolve(publishedRoot, "active-manifest.json"), bytes);
  await writeFile(resolve(publishedRoot, "manifest.json"), bytes);
  return result;
}
