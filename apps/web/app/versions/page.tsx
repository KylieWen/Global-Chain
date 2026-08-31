import Link from "next/link";
import { readFile } from "node:fs/promises";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { getPublishedReleaseManifestPath, listPublishedDatasetVersions } from "../../lib/data-manifest";
import { productPath } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default async function VersionsPage() {
  const versions = listPublishedDatasetVersions();
  const manifests = await Promise.all(versions.map(async (version) => {
    try {
      const manifestPath = getPublishedReleaseManifestPath(version);
      if (!manifestPath) return {};
      return JSON.parse(await readFile(manifestPath, "utf8")) as { datasetVersion?: string; generatedAt?: string; notes?: string[]; release?: { immutable?: boolean } };
    } catch { return {}; }
  }));
  return <SiteShell><div className="content-column narrow-column">
    <Breadcrumbs items={[{ label: "数据版本" }]} />
    <PageIntro eyebrow="Dataset history" title="数据版本" description="每个版本都是一个独立的数据快照。你可以选择不同版本，查看当时已经整理的国家、节点和证据。" actions={<Link className="button button-secondary" href="/products">返回商品探索</Link>} />
    <div className="version-list">{versions.map((version, index) => { const manifest = manifests[index] ?? {}; return <article className="version-card" key={version}><div className="version-card-top"><strong>{version}</strong>{index === 0 ? <span className="coverage-status coverage-status-route_published">最新版本</span> : null}</div><p>{manifest.notes?.[0] ?? "当前版本的研究数据快照"}</p><div className="version-meta"><span>更新时间：{manifest.generatedAt ?? "未提供"}</span></div><Link className="card-footer" href={productPath("generic-smartphone", { datasetVersion: version })}>使用此版本探索手机 →</Link></article>; })}</div>
  </div></SiteShell>;
}
