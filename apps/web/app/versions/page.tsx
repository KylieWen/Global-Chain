import { itemLabel } from "../../lib/item-label";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import { notFound } from "next/navigation";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { firstParam, type SearchParamsLike } from "../../lib/context";
import { getQueryService } from "../../lib/data";
import { getPublishedReleaseManifestPath, listPublishedDatasetVersions } from "../../lib/data-manifest";
import { productPath } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default async function VersionsPage({ searchParams }: { searchParams: Promise<SearchParamsLike> }) {
  const query = await searchParams;
  const products = (await getQueryService()).listProducts();
  const selectedId = firstParam(query.product) ?? products[0]?.productId;
  const selectedProduct = products.find(({ productId }) => productId === selectedId);
  if (selectedId && !selectedProduct) notFound();
  const versions = selectedId ? listPublishedDatasetVersions(selectedId) : [];
  const manifests = await Promise.all(versions.map(async (version) => {
    try {
      const manifestPath = getPublishedReleaseManifestPath(version, selectedId);
      if (!manifestPath) return {};
      return JSON.parse(await readFile(manifestPath, "utf8")) as { datasetVersion?: string; generatedAt?: string; notes?: string[]; release?: { immutable?: boolean } };
    } catch { return {}; }
  }));
  return <SiteShell><div className="content-column narrow-column">
    <Breadcrumbs items={[{ label: "数据版本" }]} />
    <PageIntro eyebrow="研究版本" title="数据版本" description="选择商品及其历史研究快照，查看当时已整理的国家、节点和证据。" actions={<Link className="button button-secondary" href="/products">返回商品探索</Link>} />
    <nav className="filter-links" aria-label="选择商品的历史版本">
      {products.map(({ productId, item }) => <Link className={productId === selectedId ? "filter-chip active" : "filter-chip"} href={`/versions?product=${encodeURIComponent(productId)}`} key={productId}>{itemLabel(item)}</Link>)}
    </nav>
    {versions.length === 0 ? <p>该商品尚无可选择的历史发布版本。</p> : <div className="version-list">{versions.map((version, index) => { const manifest = manifests[index] ?? {}; return <article className="version-card" key={version}><div className="version-card-top"><strong>{version}</strong>{version === selectedProduct?.datasetVersion.version ? <span className="coverage-status coverage-status-route_published">当前启用版本</span> : null}</div><p>{manifest.notes?.[0] ?? "当前版本的研究数据快照"}</p><div className="version-meta"><span>更新时间：{manifest.generatedAt ?? "未提供"}</span></div><Link className="card-footer" href={productPath(selectedId!, { datasetVersion: version })}>使用此版本探索{itemLabel(selectedProduct?.item)} →</Link></article>; })}</div>}
  </div></SiteShell>;
}
