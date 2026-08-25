import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../../../components/site-shell";
import { PeriodLabel, PublicationBadge, StatCard, WarningList, ProvenancePanel } from "../../../../components/data-display";
import { evidenceGapsPath, productPath, supplyChainPath } from "../../../../lib/paths";

export default async function ProductProvenancePage({
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
      <div className="content-column">
        <Breadcrumbs items={[
          { label: "商品目录", href: "/products" },
          { label: overview.product.name, href: productPath(productId) },
          { label: "来源与版本" }
        ]} />
        <PageIntro
          eyebrow="Provenance & version"
          title="来源、口径与版本"
          description="这页同时说明统计数据与代表性供应链内容的来源、方法、期间、数据版本和内容版本。"
          actions={(
            <>
              <Link className="button button-primary" href={supplyChainPath(productId)}>返回供应链路径</Link>
              <Link className="button button-secondary" href={evidenceGapsPath(productId)}>证据缺口登记册</Link>
              <Link className="button button-secondary" href={productPath(productId)}>返回商品概览</Link>
            </>
          )}
        />

        <div className="stat-grid">
          <StatCard label="数据集版本" value={provenance.datasetVersion.version} detail={provenance.datasetVersion.name} />
          <StatCard label="路线内容版本" value={provenance.route.contentVersion?.version ?? "未提供"} detail={provenance.route.method} />
          <StatCard label="发布状态" value={<PublicationBadge status={provenance.datasetVersion.status} />} detail="当前页面只读" />
          <StatCard label="证据缺口" value={provenance.evidenceGaps.length} detail="逐节点与逐边登记" />
          <StatCard label="适用期间" value={<PeriodLabel period={overview.period} />} detail={overview.period.start} />
        </div>

        <WarningList warnings={provenance.warnings} />
        <ProvenancePanel provenance={provenance} />

        <section className="section-block method-strip" aria-labelledby="policy-title">
          <div><p className="eyebrow">Reading policy</p><h2 id="policy-title">本项目如何避免误读</h2></div>
          <ul className="policy-list">
            <li><strong>代表性连接 ≠ 已观测双边流：</strong>国家角色资料和阶段背景不会自动成为国家间直接运输证据。</li>
            <li><strong>贸易金额 ≠ 企业利润：</strong>官方统计和成本/利润模型分开，当前不做利润推断。</li>
            <li><strong>unknown ≠ 0：</strong>没有数值时显示未知，不参与需要数值的汇总。</li>
            <li><strong>0 是事实值：</strong>只有来源明确观测为零时才显示“0 · 真实为零”。</li>
            <li><strong>数据版本 ≠ 内容版本：</strong>统计事实和策展路线分别版本化，页面同时展示两者。</li>
          </ul>
        </section>
      </div>
    </SiteShell>
  );
}
