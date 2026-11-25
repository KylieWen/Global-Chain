import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";
import { getManifestPath, getPublishedReleaseManifestPath } from "../apps/web/lib/data-manifest";
import type { SearchParamsLike } from "../apps/web/lib/context";

const { queryService } = vi.hoisted(() => ({ queryService: vi.fn() }));
vi.mock("../apps/web/lib/data", () => ({ getQueryService: queryService }));
// The shell is outside this regression. Render the real guide page, links and
// form against real immutable data without a browser navigation context.
vi.mock("../apps/web/components/site-shell", () => ({
  SiteShell: ({ children }: { children: unknown }) => children,
  ContextBanner: () => null,
  PageIntro: () => null
}));

import TradeGuidePage from "../apps/web/app/trade-guide/page";

const webRequire = createRequire(resolve("apps/web/package.json"));
const React = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const historicalVersion = "globe-chain-smartphone-2026.2";

beforeAll(() => { vi.stubGlobal("React", React); });
afterAll(() => { vi.unstubAllGlobals(); });

async function renderGuidePage(params: SearchParamsLike) {
  queryService.mockImplementation(async (requestedVersion?: string) => {
    const manifest = getPublishedReleaseManifestPath(requestedVersion) ?? getManifestPath("published");
    return createProductQueryService(await loadFixtureRepositoryFromManifest(manifest));
  });
  return renderToStaticMarkup(await TradeGuidePage({ searchParams: Promise.resolve(params) })) as string;
}

function guideLinks(markup: string): URL[] {
  return [...markup.matchAll(/href="([^"]+)"/g)]
    .map(match => new URL(match[1].replaceAll("&amp;", "&"), "http://localhost"))
    .filter(url => url.pathname === "/trade-guide");
}

describe("trade guide historical navigation", () => {
  it("keeps the selected immutable snapshot in presets, guide cards and the form", async () => {
    const markup = await renderGuidePage({ product: "generic-smartphone", datasetVersion: historicalVersion });
    const links = guideLinks(markup);
    // Four presets and four independently rendered guide-card actions.
    expect(links).toHaveLength(8);
    expect(links.every(url => url.searchParams.get("datasetVersion") === historicalVersion)).toBe(true);
    expect(markup).toContain(`type="hidden" name="datasetVersion" value="${historicalVersion}"`);
  });

  it("keeps the selected snapshot when recovering from an empty query", async () => {
    const markup = await renderGuidePage({ product: "generic-smartphone", datasetVersion: historicalVersion, jurisdiction: "not-a-covered-country", direction: "export" });
    const recovery = guideLinks(markup).find(url => !url.searchParams.has("jurisdiction"));
    expect(recovery?.searchParams.get("datasetVersion")).toBe(historicalVersion);
  });

  it("replaces an unavailable version with the actual fallback snapshot in every navigation action", async () => {
    const markup = await renderGuidePage({ product: "generic-smartphone", datasetVersion: "missing-snapshot" });
    const actual = (await queryService()).listProducts().find((entry: { productId: string }) => entry.productId === "generic-smartphone")!.datasetVersion.version;
    expect(guideLinks(markup).every(url => url.searchParams.get("datasetVersion") === actual)).toBe(true);
    expect(markup).toContain(`name="datasetVersion" value="${actual}"`);
    expect(markup).not.toContain("missing-snapshot");
  });

  it("leaves the ordinary multi-product directory unpinned so changing products still works", async () => {
    const markup = await renderGuidePage({ product: "generic-smartphone" });
    expect(markup).not.toContain('name="datasetVersion"');
    expect(guideLinks(markup).every(url => !url.searchParams.has("datasetVersion"))).toBe(true);
    expect(markup).toContain('value="generic-home-air-conditioner"');
  });
});
