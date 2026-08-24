import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../../../components/site-shell";
import { PeriodLabel, PublicationBadge, StatCard, WarningList, ProvenancePanel } from "../../../../components/data-display";
import { productPath } from "../../../../lib/paths";

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
          description="这页是数据阅读的一部分，而不是附加说明。每个事实都应能回到来源、方法、期间和数据集版本。"
          actions={<Link className="button button-secondary" href={productPath(productId)}>返回商品概览</Link>}
        />

        <div className="stat-grid">
          <StatCard label="数据集版本" value={provenance.datasetVersion.version} detail={provenance.datasetVersion.name} />
          <StatCard label="发布状态" value={<PublicationBadge status={provenance.datasetVersion.status} />} detail="当前页面只读" />
          <StatCard label="覆盖度" value={provenance.datasetVersion.coverage === null || provenance.datasetVersion.coverage === undefined ? "未知" : `${Math.round(provenance.datasetVersion.coverage * 100)}%`} detail="不是事实完整度承诺" />
          <StatCard label="适用期间" value={<PeriodLabel period={overview.period} />} detail={overview.period.start} />
        </div>

        <WarningList warnings={provenance.warnings} />
        <ProvenancePanel provenance={provenance} />

        <section className="section-block method-strip" aria-labelledby="policy-title">
          <div><p className="eyebrow">Reading policy</p><h2 id="policy-title">本项目如何避免误读</h2></div>
          <ul className="policy-list">
            <li><strong>代表性流 ≠ 唯一现实路线：</strong>路线是经过整理的内容关系，不是订单或实时物流。</li>
            <li><strong>贸易金额 ≠ 企业利润：</strong>官方统计和成本/利润模型分开，当前不做利润推断。</li>
            <li><strong>unknown ≠ 0：</strong>没有数值时显示未知，不参与需要数值的汇总。</li>
            <li><strong>0 是事实值：</strong>只有来源明确观测为零时才显示“0 · 真实为零”。</li>
            <li><strong>draft ≠ published：</strong>演示数据有明确状态，生产默认只读 published。</li>
          </ul>
        </section>
      </div>
    </SiteShell>
  );
}
