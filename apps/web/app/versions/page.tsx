import Link from "next/link";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { listPublishedDatasetVersions } from "../../lib/data-manifest";
import { productPath } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default async function VersionsPage() {
  const versions = listPublishedDatasetVersions();
  const manifests = await Promise.all(versions.map(async (version) => {
    try { return JSON.parse(await readFile(resolve(process.cwd(), "data/published/releases/generic-smartphone", version, "manifest.json"), "utf8")) as { datasetVersion?: string; generatedAt?: string; notes?: string[]; release?: { immutable?: boolean } }; } catch { return {}; }
  }));
  return <SiteShell><div className="content-column narrow-column">
    <Breadcrumbs items={[{ label: "商品目录", href: "/products" }, { label: "数据版本" }]} />
    <PageIntro eyebrow="Dataset history" title="数据版本" description="不同版本是不可变的研究快照。切换版本只改变读取的已发布数据，不会在运行时调用外部 API。" actions={<Link className="button button-secondary" href="/products">返回商品目录</Link>} />
    <div className="version-list">{versions.map((version, index) => { const manifest = manifests[index] ?? {}; return <article className="version-card" key={version}><div className="version-card-top"><span className="publication-badge publication-published">published</span><strong>{version}</strong>{index === 0 ? <span className="coverage-status coverage-status-route_published">当前列表首项</span> : null}</div><p>{manifest.notes?.[0] ?? "不可变 published 数据集"}</p><div className="version-meta"><span>生成：{manifest.generatedAt ?? "未提供"}</span><span>immutable：{manifest.release?.immutable ? "是" : "未提供"}</span></div><Link className="card-footer" href={productPath("generic-smartphone", { datasetVersion: version })}>使用此版本探索手机 →</Link></article>; })}</div>
  </div></SiteShell>;
}
