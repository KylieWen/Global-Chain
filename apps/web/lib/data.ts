import "server-only";
import { statSync } from "node:fs";
import { createAsyncCache } from "./async-cache";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import {
  createProductQueryService,
  type ProductQueryService
} from "@globe-chain/domain";
import { getManifestPath, getPublishedReleaseManifestPath } from "./data-manifest";
import { getWebDataMode } from "./runtime";

const queryServices = createAsyncCache<ProductQueryService>(6);

/** Server-only composition root for the current read-only data source. */
export function getQueryService(datasetVersion?: string): Promise<ProductQueryService> {
  const mode = getWebDataMode();
  const requestedRelease = mode === "published" ? getPublishedReleaseManifestPath(datasetVersion) : undefined;
  const manifestPath = requestedRelease ?? getManifestPath(mode);
  // Active/preview manifests can change during local publication; immutable releases
  // use the same signature rule so switching versions never shares the wrong data.
  const manifest = statSync(manifestPath);
  const cacheKey = `${mode}:${manifestPath}:${manifest.mtimeMs}:${manifest.ctimeMs}:${manifest.size}`;
  return queryServices.get(cacheKey, () => loadFixtureRepositoryFromManifest(manifestPath, {
      allowedStatuses: mode === "published" ? ["published"] : ["draft", "validated", "published"]
    }).then((repository) => createProductQueryService(repository)));
}
