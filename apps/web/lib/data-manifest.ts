import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
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

/** Resolve a published release manifest without allowing path traversal. */
export function getPublishedReleaseManifestPath(datasetVersion?: string): string | undefined {
  if (!datasetVersion) return getManifestPath("published");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(datasetVersion)) return undefined;
  const roots = [
    resolve(process.cwd(), "data/published/releases/generic-smartphone"),
    resolve(process.cwd(), "../../data/published/releases/generic-smartphone")
  ];
  for (const root of roots) {
    const candidate = resolve(root, datasetVersion, "manifest.json");
    if ((candidate.startsWith(root + "\\") || candidate.startsWith(`${root}/`)) && existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function listPublishedDatasetVersions(): readonly string[] {
  const root = [
    resolve(process.cwd(), "data/published/releases/generic-smartphone"),
    resolve(process.cwd(), "../../data/published/releases/generic-smartphone")
  ].find((candidate) => existsSync(candidate));
  if (!root) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(root, entry.name, "manifest.json")))
    .map((entry) => entry.name)
    .sort()
    .reverse();
}
