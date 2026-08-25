import { existsSync } from "node:fs";
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
