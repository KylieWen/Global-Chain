import "server-only";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import {
  createProductQueryService,
  type ProductQueryService
} from "@globe-chain/domain";
import { getWebDataMode } from "./runtime";

function getManifestPath(): string {
  const candidates = [
    resolve(process.cwd(), "../../data/samples/manifest.json"),
    resolve(process.cwd(), "data/samples/manifest.json")
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

let queryServicePromise: Promise<ProductQueryService> | undefined;

/** Server-only composition root for the current read-only data source. */
export function getQueryService(): Promise<ProductQueryService> {
  if (!queryServicePromise) {
    const mode = getWebDataMode();
    queryServicePromise = loadFixtureRepositoryFromManifest(getManifestPath(), {
      allowedStatuses: mode === "published" ? ["published"] : ["draft", "validated", "published"]
    }).then((repository) => createProductQueryService(repository));
  }

  return queryServicePromise;
}
