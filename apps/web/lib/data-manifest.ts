import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { getWebDataMode, type WebDataMode } from "./runtime";

const MANIFEST_RELATIVE_PATHS: Record<WebDataMode, readonly string[]> = {
  published: ["data/published/active-manifest.json", "data/published/manifest.json"],
  preview: ["data/samples/manifest.json"]
};

function getManifestCandidates(mode: WebDataMode): readonly string[] {
  return MANIFEST_RELATIVE_PATHS[mode].flatMap((relativePath) => [
    resolve(process.cwd(), relativePath),
    resolve(process.cwd(), "../../", relativePath)
  ]);
}

/**
 * Resolves the read-only fixture manifest for the current web data mode.
 *
 * An explicit manifest is useful for local verification and reproducible
 * deployments. Otherwise published and preview modes have separate defaults;
 * published mode never falls back to the sample manifest.
 */
export function getManifestPath(mode: WebDataMode = getWebDataMode()): string {
  const configuredPath = process.env.GLOBECHAIN_DATA_MANIFEST?.trim();
  if (configuredPath) {
    if (isAbsolute(configuredPath)) return resolve(configuredPath);
    const configuredCandidates = [
      resolve(process.cwd(), configuredPath),
      resolve(process.cwd(), "../../", configuredPath)
    ];
    return (
      configuredCandidates.find((candidate) => existsSync(candidate)) ?? configuredCandidates[0]
    );
  }

  const candidates = getManifestCandidates(mode);
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export interface PublishedReleaseEntry {
  readonly productId: string;
  readonly datasetVersion: string;
  readonly manifestPath: string;
}

const SAFE_RELEASE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function staysInside(root: string, candidate: string): boolean {
  const path = relative(realpathSync(root), realpathSync(candidate));
  return Boolean(path) && !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`);
}

/** Discover immutable releases for every product, with an optional product scope. */
export function listPublishedReleaseEntries(productId?: string): readonly PublishedReleaseEntry[] {
  if (productId !== undefined && !SAFE_RELEASE_SEGMENT.test(productId)) return [];
  const root = [
    resolve(process.cwd(), "data/published/releases"),
    resolve(process.cwd(), "../../data/published/releases")
  ].find((candidate) => existsSync(candidate));
  if (!root) return [];
  const entries: PublishedReleaseEntry[] = [];
  for (const product of readdirSync(root, { withFileTypes: true })) {
    if (!product.isDirectory() || !SAFE_RELEASE_SEGMENT.test(product.name) || (productId && product.name !== productId)) continue;
    const productRoot = resolve(root, product.name);
    if (!staysInside(root, productRoot)) continue;
    for (const version of readdirSync(productRoot, { withFileTypes: true })) {
      if (!version.isDirectory() || !SAFE_RELEASE_SEGMENT.test(version.name)) continue;
      const manifestPath = resolve(productRoot, version.name, "manifest.json");
      try {
        if (!staysInside(productRoot, manifestPath)) continue;
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
          schemaVersion?: string;
          datasetVersion?: string;
          fixtures?: { productId?: string }[];
          release?: { productId?: string; datasetVersion?: string; immutable?: boolean };
        };
        if (manifest.schemaVersion !== "fixture-manifest.v1" || manifest.datasetVersion !== version.name ||
            manifest.release?.productId !== product.name || manifest.release.datasetVersion !== version.name ||
            manifest.release.immutable !== true || manifest.fixtures?.length !== 1 || manifest.fixtures[0].productId !== product.name) continue;
        entries.push({ productId: product.name, datasetVersion: version.name, manifestPath });
      } catch {
        // An incomplete or invalid candidate is not a selectable published release.
      }
    }
  }
  return entries.sort((left, right) => right.datasetVersion.localeCompare(left.datasetVersion, undefined, { numeric: true }) || left.productId.localeCompare(right.productId));
}

/** Ambiguous version names require a product ID; unsafe selectors never become paths. */
export function getPublishedReleaseManifestPath(datasetVersion?: string, productId?: string): string | undefined {
  if (!datasetVersion) return getManifestPath("published");
  if (!SAFE_RELEASE_SEGMENT.test(datasetVersion)) return undefined;
  const matches = listPublishedReleaseEntries(productId).filter((entry) => entry.datasetVersion === datasetVersion);
  return matches.length === 1 ? matches[0].manifestPath : undefined;
}

export function listPublishedDatasetVersions(productId?: string): readonly string[] {
  return [...new Set(listPublishedReleaseEntries(productId).map((entry) => entry.datasetVersion))];
}
