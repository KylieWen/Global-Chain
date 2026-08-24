import "server-only";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import {
  createProductQueryService,
  type ProductQueryService
} from "@globe-chain/domain";
import { getManifestPath } from "./data-manifest";
import { getWebDataMode } from "./runtime";

let queryServicePromise: Promise<ProductQueryService> | undefined;
let queryServiceCacheKey: string | undefined;

/** Server-only composition root for the current read-only data source. */
export function getQueryService(): Promise<ProductQueryService> {
  const mode = getWebDataMode();
  const manifestPath = getManifestPath(mode);
  const cacheKey = `${mode}:${manifestPath}`;

  if (!queryServicePromise || queryServiceCacheKey !== cacheKey) {
    queryServiceCacheKey = cacheKey;
    queryServicePromise = loadFixtureRepositoryFromManifest(manifestPath, {
      allowedStatuses: mode === "published" ? ["published"] : ["draft", "validated", "published"]
    }).then((repository) => createProductQueryService(repository));
  }

  return queryServicePromise;
}
