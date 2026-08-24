import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { getManifestPath } from "../apps/web/lib/data-manifest";
import { getWebDataMode } from "../apps/web/lib/runtime";

const originalMode = process.env.GLOBECHAIN_DATA_MODE;
const originalAllowDraft = process.env.GLOBECHAIN_ALLOW_DRAFT;
const originalManifest = process.env.GLOBECHAIN_DATA_MANIFEST;
const originalNodeEnv = process.env.NODE_ENV;

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnvironmentVariable("GLOBECHAIN_DATA_MODE", originalMode);
  restoreEnvironmentVariable("GLOBECHAIN_ALLOW_DRAFT", originalAllowDraft);
  restoreEnvironmentVariable("GLOBECHAIN_DATA_MANIFEST", originalManifest);
  restoreEnvironmentVariable("NODE_ENV", originalNodeEnv);
});

describe("web fixture manifest selection", () => {
  it("uses separate published and preview defaults", () => {
    delete process.env.GLOBECHAIN_DATA_MANIFEST;

    expect(getManifestPath("published")).toBe(resolve("data/published/manifest.json"));
    expect(getManifestPath("preview")).toBe(resolve("data/samples/manifest.json"));
  });

  it("uses the environment-selected mode when no mode argument is provided", () => {
    delete process.env.GLOBECHAIN_DATA_MANIFEST;
    process.env.NODE_ENV = "development";

    process.env.GLOBECHAIN_DATA_MODE = "preview";
    expect(getManifestPath()).toBe(resolve("data/samples/manifest.json"));

    process.env.GLOBECHAIN_DATA_MODE = "published";
    expect(getManifestPath()).toBe(resolve("data/published/manifest.json"));
  });

  it("honors an explicit manifest override for either mode", () => {
    const sampleManifestPath = resolve("data/samples/manifest.json");
    process.env.GLOBECHAIN_DATA_MANIFEST = "data/samples/manifest.json";

    expect(getManifestPath("published")).toBe(sampleManifestPath);
    expect(getManifestPath("preview")).toBe(sampleManifestPath);
  });

  it("keeps draft fixtures out of the published query boundary", async () => {
    process.env.GLOBECHAIN_DATA_MANIFEST = resolve("data/samples/manifest.json");
    process.env.NODE_ENV = "development";

    process.env.GLOBECHAIN_DATA_MODE = "preview";
    const previewRepository = await loadFixtureRepositoryFromManifest(
      getManifestPath(getWebDataMode()),
      { allowedStatuses: ["draft", "validated", "published"] }
    );
    expect(previewRepository.listProductIds()).toEqual(["generic-smartphone", "coffee"]);

    process.env.GLOBECHAIN_DATA_MODE = "published";
    const publishedRepository = await loadFixtureRepositoryFromManifest(
      getManifestPath(getWebDataMode()),
      { allowedStatuses: ["published"] }
    );
    expect(publishedRepository.listProductIds()).toEqual([]);
  });
});
