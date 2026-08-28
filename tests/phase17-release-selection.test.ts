import { describe, expect, it } from "vitest";
import { getPublishedReleaseManifestPath, listPublishedDatasetVersions } from "../apps/web/lib/data-manifest";

describe("phase 17 published release selection", () => {
  it("lists immutable releases and resolves a valid historical manifest", () => {
    const versions = listPublishedDatasetVersions();
    expect(versions).toEqual(expect.arrayContaining(["globe-chain-smartphone-2023.3", "globe-chain-smartphone-2023.4", "globe-chain-smartphone-2023.6"]));
    expect(versions[0]).toBe("globe-chain-smartphone-2023.14");
    expect(getPublishedReleaseManifestPath("globe-chain-smartphone-2023.3")).toContain("globe-chain-smartphone-2023.3\\manifest.json");
  });

  it("rejects unknown or unsafe release selectors", () => {
    expect(getPublishedReleaseManifestPath("missing-release")).toBeUndefined();
    expect(getPublishedReleaseManifestPath("..\\manifest.json")).toBeUndefined();
  });
});
