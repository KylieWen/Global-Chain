import { ProductNavigation } from "../../../../components/product-navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../lib/data";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../../../components/site-shell";
import { PeriodLabel, PublicationBadge, StatCard, WarningList, ProvenancePanel } from "../../../../components/data-display";
import { evidenceGapsPath, materialObservationsPath, productPath, researchExportPath, supplyChainPath } from "../../../../lib/paths";
import { contextMismatch, readPageContext, type SearchParamsLike } from "../../../../lib/context";
import { listPublishedDatasetVersions } from "../../../../lib/data-manifest";

export default async function ProductProvenancePage({
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
  const materialObservations = queries.getMaterialTradeObservations(productId);
  const releaseVersions = listPublishedDatasetVersions(productId);
  if (!overview || !provenance) notFound();
  const mismatches = contextMismatch(pageContext, { period: overview.period.label, datasetVersion: provenance.datasetVersion.version, contentVersion: provenance.route.contentVersion?.version });

  return (
    <SiteShell>
      <div className="content-column">
        <Breadcrumbs items={[
          { label: "商品目录", href: "/products" },
          { label: overview.product.name, href: productPath(productId, pageContext) },
          { label: "来源与版本" }
        ]} />
        <ContextBanner period={overview.period.label} datasetVersion={provenance.datasetVersion.version} contentVersion={provenance.route.contentVersion?.version} mismatches={mismatches} />
        <PageIntro
          eyebrow="Provenance & version"
          title="来源、口径与版本"
          description="这页同时说明统计数据与代表性供应链内容的来源、方法、期间、数据版本和内容版本。"
          actions={(
            <>
              <Link className="button button-primary" href={supplyChainPath(productId, undefined, pageContext)}>返回供应链路径</Link>
              <Link className="button button-secondary" href={evidenceGapsPath(productId, pageContext)}>证据缺口登记册</Link>
              <Link className="button button-secondary" href={materialObservationsPath(productId, pageContext)}>材料观察浏览器</Link>
              <a className="button button-secondary" href={researchExportPath(productId)}>下载研究快照（JSON）</a>
              <Link className="button button-secondary" href={productPath(productId, pageContext)}>返回商品概览</Link>
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

        <ProductNavigation productId={productId} context={pageContext} active="sources" hasIndustry={Boolean(queries.getIndustryNetwork(productId))} hasMaterials={materialObservations.length>0}/>
        <section className="section-block" aria-labelledby="release-selector-title">
          <div className="section-heading"><div><p className="eyebrow">研究版本</p><h2 id="release-selector-title">选择研究版本</h2></div><span className="section-caption">历史版本只读，不会覆盖当前发布版本</span></div>
          <p className="muted">选择版本后，商品、供应链、账本、材料观察和证据页面都会读取对应的只读历史数据快照。版本参数不再只是提示，而是实际查询选择。</p>
          <div className="filter-links">
            {releaseVersions.map((version) => {
              const href = productPath(productId, { period: overview.period.label, datasetVersion: version });
              return <Link className={version === provenance.datasetVersion.version ? "filter-chip active" : "filter-chip"} href={href} key={version}>{version}{version === provenance.datasetVersion.version ? " · 当前" : ""}</Link>;
            })}
          </div>
        </section>

        <section className="section-block method-strip" aria-labelledby="research-export-title">
          <div><p className="eyebrow">Versioned research export</p><h2 id="research-export-title">可复核研究快照</h2></div>
          <p>JSON 导出包含商品维度、供应链、国家贸易观察、材料贸易观察、来源、逐条证据和证据缺口，并同时保留数据集版本与内容版本。它是当前 published 输入的确定性只读快照，不会补齐未知值或生成新结论。</p>
          <a className="text-link" href={researchExportPath(productId)}>下载 {provenance.datasetVersion.version} 研究快照 →</a>
        </section>

        <ProvenancePanel provenance={provenance} />

        <section className="section-block" aria-labelledby="material-observations-title">
          <div className="section-heading"><div><p className="eyebrow">Material customs observations</p><h2 id="material-observations-title">材料双边贸易观察</h2></div><span className="muted">{materialObservations.length} 条 · 各条期间与分类如下</span></div>
          <p className="muted">这些观察只证明统计方与伙伴发生了对应 HS 分类商品贸易，不证明材料进入手机、电池、指定工厂或连续物料谱系。</p>
          <div className="trade-observation-list">
            {materialObservations.map(({ observation, reporter, partner, item }) => (
              <article className="trade-observation-card" key={observation.observationId}>
                <div className="trade-observation-heading"><div><strong>{item?.name ?? observation.materialItemId}</strong><div className="muted">{reporter?.name ?? observation.reporterEntityId} → {partner?.name ?? (observation.partnerScope === "world_total" ? "世界总计" : "未知伙伴")}</div></div><span className="status-badge">{observation.flow} · {observation.partnerScope}</span></div>
                <div className="fact-metadata-grid"><span>HS {observation.classificationCode}</span><span>{observation.classificationMappingType}</span><span>{observation.period.label}</span><span>{observation.valueDataStatus} / 数量 {observation.quantityDataStatus}</span></div>
                <div className="trade-values"><div><small>金额</small><strong>{observation.value === null ? "未知" : `${observation.currency ?? ""} ${observation.value.toLocaleString()}`}</strong></div><div><small>数量</small><strong>{observation.quantity === null ? "未知/未提供" : `${observation.quantity.toLocaleString()} ${observation.unit ?? "单位未收录"}`}</strong></div></div>
                <p className="muted">{observation.limitation}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block method-strip" aria-labelledby="policy-title">
          <div><p className="eyebrow">阅读方法</p><h2 id="policy-title">本项目如何避免误读</h2></div>
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
