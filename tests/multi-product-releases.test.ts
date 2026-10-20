import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { activatePublishedRelease, listPublishedReleases, prepareReleaseActivation, readPublishedRelease, verifyPublishedManifest } from "../scripts/lib/published-releases.mjs";
import { getPublishedReleaseManifestPath, listPublishedDatasetVersions, listPublishedReleaseEntries } from "../apps/web/lib/data-manifest";

const temporaryRoots: string[] = [];
const digest = (text: string) => createHash("sha256").update(text).digest("hex");

afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(resolve(tmpdir()) + sep) || !root.includes(`${sep}globe-chain-release-test-`)) throw new Error("Unsafe test cleanup target");
    await rm(root, { recursive: true, force: true });
  }
});

async function sandbox() {
  const root = await mkdtemp(resolve(tmpdir(), "globe-chain-release-test-"));
  temporaryRoots.push(root);
  const published = resolve(root, "data/published");
  await mkdir(published, { recursive: true });
  return { root, published };
}

// These small records test release metadata only; they are never installed in the project's catalog.
async function release(published: string, productId: string, version: string, overrides: { status?: string; method?: string } = {}) {
  const directory = resolve(published, "releases", productId, version);
  await mkdir(directory, { recursive: true });
  const fixturePath = resolve(directory, "fixture.json");
  const fixture = JSON.stringify({ schemaVersion: "product-fixture.v1", productId, datasetVersion: { version, status: overrides.status ?? "published" }, items: [{ method: overrides.method ?? "curated" }] });
  await writeFile(fixturePath, fixture);
  const manifest = { schemaVersion: "fixture-manifest.v1", fixtures: [{ productId, path: "fixture.json" }], datasetVersion: version, fixtureSha256: digest(fixture), release: { productId, datasetVersion: version, immutable: true } };
  await writeFile(resolve(directory, "manifest.json"), JSON.stringify(manifest));
  return { manifest, entry: { productId, path: `releases/${productId}/${version}/fixture.json`, datasetVersion: version, fixtureSha256: digest(fixture) }, fixturePath };
}

async function setActive(published: string, releases: Awaited<ReturnType<typeof release>>[]) {
  const manifest = { ...releases[0].manifest, fixtures: releases.map(({ entry }) => entry), activeManifest: true, activeDatasetVersion: releases[0].manifest.datasetVersion };
  const bytes = JSON.stringify(manifest);
  await writeFile(resolve(published, "active-manifest.json"), bytes);
  await writeFile(resolve(published, "manifest.json"), bytes);
  return manifest;
}

describe("multi-product immutable release lifecycle", () => {
  it("replaces only the selected product and keeps both active pointers aligned", async () => {
    const { published } = await sandbox();
    const old = await release(published, "alpha", "v1");
    const next = await release(published, "alpha", "v2");
    const beta = await release(published, "beta", "beta-v1");
    await setActive(published, [old, beta]);
    const immutableBytes = await readFile(next.fixturePath, "utf8");

    const result = await activatePublishedRelease(published, { datasetVersion: "v2" });
    expect(result.manifest.fixtures).toEqual([next.entry, beta.entry]);
    expect(await readFile(next.fixturePath, "utf8")).toBe(immutableBytes);
    expect(await readFile(resolve(published, "active-manifest.json"), "utf8")).toBe(await readFile(resolve(published, "manifest.json"), "utf8"));
    expect((await verifyPublishedManifest(published, result.manifest)).map((entry: { productId: string }) => entry.productId)).toEqual(["alpha", "beta"]);
  });

  it("adds a second product without removing the original and supports legacy single-product rollback", async () => {
    const { published } = await sandbox();
    const old = await release(published, "alpha", "v1");
    const current = await release(published, "alpha", "v2");
    const future = await release(published, "alpha", "v10");
    const beta = await release(published, "beta", "beta-v1");
    await setActive(published, [current]);
    const rollback = await prepareReleaseActivation(published, { rollback: true });
    expect(rollback.manifest.fixtures).toEqual([old.entry]);
    expect(rollback.selected.datasetVersion).not.toBe(future.manifest.datasetVersion);
    const addition = await activatePublishedRelease(published, { productId: "beta", datasetVersion: "beta-v1" });
    expect(addition.manifest.fixtures).toEqual([current.entry, beta.entry]);
    await expect(prepareReleaseActivation(published, { rollback: true })).rejects.toThrow("specify --product");
    const scopedRollback = await prepareReleaseActivation(published, { productId: "alpha", rollback: true });
    expect(scopedRollback.manifest.fixtures).toEqual([old.entry, beta.entry]);
  });

  it("requires a product when two products share a version name", async () => {
    const { published } = await sandbox();
    const alpha = await release(published, "alpha", "v1");
    const beta = await release(published, "beta", "v1");
    await setActive(published, [alpha]);
    expect(await listPublishedReleases(published)).toHaveLength(2);
    await expect(prepareReleaseActivation(published, { datasetVersion: "v1" })).rejects.toThrow("Ambiguous");
    const result = await prepareReleaseActivation(published, { productId: "beta", datasetVersion: "v1" });
    expect(result.manifest.fixtures).toEqual([alpha.entry, beta.entry]);
  });

  it("detects corruption in the second product before writing either active pointer", async () => {
    const { published } = await sandbox();
    const alpha = await release(published, "alpha", "v1");
    await release(published, "alpha", "v2");
    const beta = await release(published, "beta", "beta-v1");
    const manifest = await setActive(published, [alpha, beta]);
    const before = await readFile(resolve(published, "active-manifest.json"), "utf8");
    await writeFile(beta.fixturePath, (await readFile(beta.fixturePath, "utf8")) + " ");
    await expect(verifyPublishedManifest(published, manifest)).rejects.toThrow("hash mismatch");
    await expect(activatePublishedRelease(published, { datasetVersion: "v2" })).rejects.toThrow("hash mismatch");
    expect(await readFile(resolve(published, "active-manifest.json"), "utf8")).toBe(before);
    expect(await readFile(resolve(published, "manifest.json"), "utf8")).toBe(before);
  });

  it("rejects draft and mock candidates even when their hashes match", async () => {
    const { published } = await sandbox();
    const alpha = await release(published, "alpha", "v1");
    await setActive(published, [alpha]);
    await release(published, "beta", "draft-v1", { status: "draft" });
    await release(published, "beta", "mock-v1", { method: "mock" });
    await expect(prepareReleaseActivation(published, { datasetVersion: "draft-v1" })).rejects.toThrow("not published");
    await expect(prepareReleaseActivation(published, { datasetVersion: "mock-v1" })).rejects.toThrow("Mock records");
  });

  it("rejects traversal and duplicate active identities", async () => {
    const { published } = await sandbox();
    const alpha = await release(published, "alpha", "v1");
    const manifest = await setActive(published, [alpha]);
    await expect(verifyPublishedManifest(published, { ...manifest, fixtures: [{ productId: "alpha", path: "../outside.json" }] })).rejects.toThrow("stay inside");
    await expect(verifyPublishedManifest(published, { ...manifest, fixtures: [alpha.entry, alpha.entry] })).rejects.toThrow("duplicate");
    await expect(prepareReleaseActivation(published, { datasetVersion: "../v1" })).rejects.toThrow("Unsafe");
    await expect(prepareReleaseActivation(published, { productId: "..\\alpha", datasetVersion: "v1" })).rejects.toThrow("Unsafe");
  });

  it("rejects conflicting declared metadata and an immutable manifest's escaping fixture path", async () => {
    const { published } = await sandbox();
    const alpha = await release(published, "alpha", "v1");
    const manifest = await setActive(published, [alpha]);
    await expect(verifyPublishedManifest(published, { ...manifest, activeDatasetVersion: "wrong-version" })).rejects.toThrow("version mismatch");
    await expect(verifyPublishedManifest(published, { ...manifest, fixtures: [{ ...alpha.entry, fixtureSha256: "wrong-hash" }] })).rejects.toThrow("hash mismatch");
    await writeFile(resolve(dirname(alpha.fixturePath), "manifest.json"), JSON.stringify({ ...alpha.manifest, fixtures: [{ productId: "alpha", path: "../outside.json" }] }));
    await expect(readPublishedRelease(published, "alpha", "v1")).rejects.toThrow("stay inside");
  });

  it("checks the hash of an attached evidence-review audit", async () => {
    const { published } = await sandbox();
    const alpha = await release(published, "alpha", "v1");
    const auditPath = resolve(dirname(alpha.fixturePath), "review-audit.json");
    const audit = JSON.stringify({ batchId: "unit-test-review" });
    await writeFile(auditPath, audit);
    await writeFile(resolve(dirname(alpha.fixturePath), "manifest.json"), JSON.stringify({ ...alpha.manifest, evidenceReview: { auditPath: "review-audit.json", auditSha256: digest(audit) } }));
    expect((await readPublishedRelease(published, "alpha", "v1")).productId).toBe("alpha");
    await writeFile(auditPath, audit + " ");
    await expect(readPublishedRelease(published, "alpha", "v1")).rejects.toThrow("evidence audit hash mismatch");
  });

  it("rejects directory junctions that point outside the published root", async (context) => {
    const { root, published } = await sandbox();
    const outside = resolve(root, "outside");
    await mkdir(outside);
    await mkdir(resolve(published, "releases/escape"), { recursive: true });
    try {
      await symlink(outside, resolve(published, "releases/escape/v1"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
      context.skip(); // Some Windows sandboxes forbid link creation; ordinary traversal checks still run.
      return;
    }
    await expect(readPublishedRelease(published, "escape", "v1")).rejects.toThrow("outside");
    vi.spyOn(process, "cwd").mockReturnValue(root);
    expect(getPublishedReleaseManifestPath("v1", "escape")).toBeUndefined();
  });
});

describe("multi-product web release discovery", () => {
  it("lists all products, scopes version selectors, and refuses ambiguous version names", async () => {
    const { root, published } = await sandbox();
    const alpha = await release(published, "alpha", "v1");
    const beta = await release(published, "beta", "v1");
    await release(published, "beta", "v2");
    vi.spyOn(process, "cwd").mockReturnValue(root);
    expect(listPublishedReleaseEntries()).toHaveLength(3);
    expect(listPublishedDatasetVersions("beta")).toEqual(["v2", "v1"]);
    expect(getPublishedReleaseManifestPath("v1")).toBeUndefined();
    expect(getPublishedReleaseManifestPath("v1", "alpha")).toBe(resolve(dirname(alpha.fixturePath), "manifest.json"));
    expect(getPublishedReleaseManifestPath("v1", "beta")).toBe(resolve(dirname(beta.fixturePath), "manifest.json"));
    expect(getPublishedReleaseManifestPath("../v1", "beta")).toBeUndefined();
    expect(listPublishedDatasetVersions("../beta")).toEqual([]);
  });

  it("ignores incomplete and mismatched manifests", async () => {
    const { root, published } = await sandbox();
    await release(published, "alpha", "v1");
    const bad = await release(published, "beta", "v2");
    await writeFile(resolve(dirname(bad.fixturePath), "manifest.json"), JSON.stringify({ ...bad.manifest, release: { ...bad.manifest.release, productId: "alpha" } }));
    await mkdir(resolve(published, "releases/beta/incomplete"));
    vi.spyOn(process, "cwd").mockReturnValue(root);
    expect(listPublishedDatasetVersions()).toEqual(["v1"]);
  });
});
