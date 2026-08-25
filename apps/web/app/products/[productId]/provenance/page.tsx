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
  const materialObservations = queries.getMaterialTradeObservations(productId);
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

        <section className="section-block" aria-labelledby="material-observations-title">
          <div className="section-heading"><div><p className="eyebrow">Material customs observations</p><h2 id="material-observations-title">材料双边贸易观察</h2></div><span className="muted">{materialObservations.length} 条 · 2023 · HS 2022</span></div>
          <p className="muted">这些观察只证明统计方与伙伴发生了对应 HS 分类商品贸易，不证明材料进入手机、电池、指定工厂或连续物料谱系。</p>
          <div className="trade-observation-list">
            {materialObservations.map(({ observation, reporter, partner, item }) => (
              <article className="trade-observation-card" key={observation.observationId}>
                <div className="trade-observation-heading"><div><strong>{item?.name ?? observation.materialItemId}</strong><div className="muted">{reporter?.name ?? observation.reporterEntityId} → {partner?.name ?? (observation.partnerScope === "world_total" ? "世界总计" : "未知伙伴")}</div></div><span className="status-badge">{observation.flow} · {observation.partnerScope}</span></div>
                <div className="fact-metadata-grid"><span>HS {observation.classificationCode}</span><span>{observation.classificationMappingType}</span><span>{observation.period.label}</span><span>{observation.valueDataStatus} / 数量 {observation.quantityDataStatus}</span></div>
                <div className="trade-values"><div><small>金额</small><strong>{observation.value === null ? "未知" : `${observation.currency ?? ""} ${observation.value.toLocaleString()}`}</strong></div><div><small>数量</small><strong>{observation.quantity === null ? "未知/未提供" : observation.quantity.toLocaleString()}</strong></div></div>
                <p className="muted">{observation.limitation}</p>
              </article>
            ))}
          </div>
        </section>

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
