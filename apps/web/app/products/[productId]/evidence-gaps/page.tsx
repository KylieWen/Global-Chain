import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../../../components/site-shell";
import {
  EvidenceGapRegistry,
  PeriodLabel,
  PublicationBadge,
  StatCard,
  WarningList
} from "../../../../components/data-display";
import { productPath, provenancePath, supplyChainPath } from "../../../../lib/paths";

export default async function ProductEvidenceGapsPage({
  params
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const queries = await getQueryService();
  const overview = queries.getProductOverview(productId);
  const provenance = queries.getProvenance(productId);
  if (!overview || !provenance) notFound();

  return (
    <SiteShell>
      <div className="content-column wide-column">
        <Breadcrumbs items={[
          { label: "商品目录", href: "/products" },
          { label: overview.product.name, href: productPath(productId) },
          { label: "证据缺口登记册" }
        ]} />
        <PageIntro
          eyebrow="Evidence gap registry"
          title={`${overview.product.name} · 证据缺口登记册`}
          description="逐节点、逐连接记录当前主张、可接受证据和不可推断内容。登记册只展示已发布数据与内容配置，不会在运行时补齐事实。"
          actions={(
            <>
              <Link className="button button-primary" href={supplyChainPath(productId)}>供应链路径</Link>
              <Link className="button button-secondary" href={provenancePath(productId)}>来源与版本</Link>
            </>
          )}
        />
        <div className="stat-grid">
          <StatCard label="登记缺口" value={provenance.evidenceGaps.length} detail="节点或连接主张" />
          <StatCard label="适用期间" value={<PeriodLabel period={overview.period} />} detail={overview.period.start} />
          <StatCard label="数据集版本" value={provenance.datasetVersion.version} detail={provenance.datasetVersion.name} />
          <StatCard label="发布状态" value={<PublicationBadge status={provenance.datasetVersion.status} />} detail="只读登记册" />
        </div>
        <WarningList warnings={provenance.warnings} />
        <section className="section-block" aria-labelledby="registry-title">
          <div className="section-heading">
            <div><p className="eyebrow">Claim boundaries</p><h2 id="registry-title">所有登记项</h2></div>
            <span className="section-caption">open、partial、closed 和公开资料不可观测分别呈现</span>
          </div>
          <EvidenceGapRegistry gaps={provenance.evidenceGaps} />
        </section>
      </div>
    </SiteShell>
  );
}
