import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";

const publishedRoot = resolve("data/published");

describe("phase 15 published release lifecycle", () => {
  it("uses an active manifest that points at an immutable release directory", async () => {
    const active = JSON.parse(await readFile(resolve(publishedRoot, "active-manifest.json"), "utf8"));
    const fixturePath = resolve(publishedRoot, active.fixtures[0].path);
    const fixtureText = await readFile(fixturePath, "utf8");
    const fixture = JSON.parse(fixtureText);

    expect(active.activeManifest).toBe(true);
    expect(active.activeDatasetVersion).toBe("globe-chain-smartphone-2023.13");
    expect(active.fixtures[0].path).toContain("releases/generic-smartphone/");
    expect(fixture.datasetVersion.version).toBe(active.activeDatasetVersion);
    expect(active.fixtureSha256).toBe(createHash("sha256").update(fixtureText).digest("hex"));
  });

  it("keeps a previous published release loadable for audit and rollback", async () => {
    const historicalManifest = resolve(publishedRoot, "releases/generic-smartphone/globe-chain-smartphone-2023.3/manifest.json");
    const repository = await loadFixtureRepositoryFromManifest(historicalManifest);
    expect(repository.listProductIds()).toEqual(["generic-smartphone"]);
    expect(repository.getProductFixture("generic-smartphone")?.datasetVersion.version).toBe("globe-chain-smartphone-2023.3");
  });

  it("keeps active and compatibility manifests aligned", async () => {
    const active = await readFile(resolve(publishedRoot, "active-manifest.json"), "utf8");
    const compatibility = await readFile(resolve(publishedRoot, "manifest.json"), "utf8");
    expect(JSON.parse(active).activeDatasetVersion).toBe(JSON.parse(compatibility).activeDatasetVersion);
    expect(JSON.parse(active).fixtures).toEqual(JSON.parse(compatibility).fixtures);
  });
});
