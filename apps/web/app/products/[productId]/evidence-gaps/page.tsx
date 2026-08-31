import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../lib/data";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../../../components/site-shell";
import {
  EvidenceGapRegistry,
  PeriodLabel,
  PublicationBadge,
  StatCard,
  WarningList
} from "../../../../components/data-display";
import { materialObservationsPath, productPath, provenancePath, supplyChainPath } from "../../../../lib/paths";
import { contextMismatch, readPageContext, type SearchParamsLike } from "../../../../lib/context";

export default async function ProductEvidenceGapsPage({
  params,
  searchParams
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<SearchParamsLike>;
}) {
  const { productId } = await params;
  const pageContext = readPageContext(await searchParams);
  const queries = await getQueryService(pageContext.datasetVersion);
  const overview = queries.getProductOverview(productId);
  const provenance = queries.getProvenance(productId);
  if (!overview || !provenance) notFound();
  const mismatches = contextMismatch(pageContext, { period: overview.period.label, datasetVersion: provenance.datasetVersion.version, contentVersion: provenance.route.contentVersion?.version });

  return (
    <SiteShell>
      <div className="content-column wide-column">
        <Breadcrumbs items={[
          { label: "商品目录", href: "/products" },
          { label: overview.product.name, href: productPath(productId, pageContext) },
          { label: "证据缺口登记册" }
        ]} />
        <ContextBanner period={overview.period.label} datasetVersion={provenance.datasetVersion.version} contentVersion={provenance.route.contentVersion?.version} mismatches={mismatches} />
        <PageIntro
          eyebrow="证据完整度"
          title={`${overview.product.name} · 证据缺口登记册`}
          description="这里列出当前仍需核验的节点和连接。先看摘要，再按需展开来源、证据范围和审计细节；未收录的数据不会被补成零。"
          actions={(
            <>
              <Link className="button button-primary" href={supplyChainPath(productId, undefined, pageContext)}>供应链路径</Link>
              <Link className="button button-secondary" href={provenancePath(productId, pageContext)}>来源与版本</Link>
              <Link className="button button-secondary" href={materialObservationsPath(productId, pageContext)}>材料贸易观察</Link>
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
            <div><p className="eyebrow">主张边界</p><h2 id="registry-title">关键缺口与完整登记</h2></div>
            <span className="section-caption">先看最需要核验的 5 条主张，其余登记项可展开</span>
          </div>
          <EvidenceGapRegistry gaps={provenance.evidenceGaps} progressiveDisclosure visibleCount={5} />
        </section>
      </div>
    </SiteShell>
  );
}
