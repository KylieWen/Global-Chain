import { itemLabel } from "../../../../../lib/item-label";
import { ProductNavigation } from "../../../../../components/product-navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../../lib/data";
import { ContextBanner, PageIntro, SiteShell } from "../../../../../components/site-shell";
import { contextMismatch, readPageContext } from "../../../../../lib/context";
import {
  dataMethodLabel,
  factStatusLabel,
  MetadataItem,
  PeriodLabel,
  publicationStatusLabel,
  StatCard,
  StatusBadge,
  StatusLegend,
  UnknownValue,
  ValueDisplay,
  WarningList
} from "../../../../../components/data-display";
import { ledgerPath, mapPath, nodePath, supplyChainPath } from "../../../../../lib/paths";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function statisticalConceptLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    customs: "海关/商品贸易统计",
    balance_of_payments: "国际收支",
    official_reserve: "官方储备",
    national_accounts: "国民账户",
    other: "其他"
  };
  return value ? labels[value] ?? value : "未提供";
}

export default async function CountryLedgerPage({
  params,
  searchParams
}: {
  params: Promise<{ productId: string; entityId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { productId, entityId } = await params;
  const query = await searchParams;
  const pageContext = readPageContext(query);
  const label = firstParam(query.label);
  const queries = await getQueryService(pageContext.datasetVersion);
  const overview = queries.getProductOverview(productId);
  if (!overview) notFound();
  const ledger = queries.getCountryLedger(productId, entityId, {
    label,
    itemId: productId
  });
  const provenance = queries.getProvenance(productId);
  if (!ledger || !provenance) notFound();
  const contextMismatches = contextMismatch(pageContext, {
    period: ledger.period.label,
    datasetVersion: ledger.datasetVersion.version,
    contentVersion: provenance.route.contentVersion?.version
  });
  const firstRelatedNode = ledger.relatedNodes[0];
  const tradeClassification = ledger.tradeClassifications[0];
  const snapshotMetrics = ledger.resolvedMacroIndicators.filter((view) => view.measurement.value !== null).slice(0, 8);

  return (
    <SiteShell>
      <div className="content-column wide-column ledger-page">
        <ProductNavigation productId={productId} context={pageContext} active="ledger" hasIndustry={Boolean(queries.getIndustryNetwork(productId))} hasMaterials={queries.getMaterialTradeObservations(productId).length>0} entityId={entityId}/>
        <PageIntro
          eyebrow="国家贸易账本"
          title={`${ledger.entity.name} · 国家账本`}
          description="查看已收录的产业与贸易数据，继续探索商品、生产环节与贸易伙伴。"
          meta={<ContextBanner period={ledger.period.label} datasetVersion={ledger.datasetVersion.version} contentVersion={provenance.route.contentVersion?.version} mismatches={contextMismatches} />}
          actions={<Link className="button button-secondary" href={firstRelatedNode ? nodePath(productId, firstRelatedNode.node.id, pageContext) : supplyChainPath(productId, undefined, pageContext)}>查看供应链</Link>}
        />


        {snapshotMetrics.length > 0 && <section className="ledger-snapshot" aria-labelledby="ledger-snapshot-title">
          <div className="section-heading"><div><p className="eyebrow">关键数据</p><h2 id="ledger-snapshot-title">关键数据</h2></div><span className="section-caption">{snapshotMetrics.length} 项指标</span></div>
          <div className="stat-grid ledger-snapshot-grid">{snapshotMetrics.map(({observation, definition, measurement, source}) => <StatCard key={observation.id} label={definition.shortLabel ?? definition.label} value={<ValueDisplay compact value={measurement.value} status={observation.dataStatus} currency={measurement.currency} unit={measurement.kind === "quantity" ? definition.displayUnit ?? measurement.unit : measurement.unit} />} detail={`${observation.period.label} · ${source?.publisher ?? source?.name ?? ""}`} />)}</div>
        </section>}

        <details className="reading-details"><summary>国家与版本信息</summary>
        <div className="stat-grid">
          <StatCard label="国家/地区代码" value={ledger.entity.iso3 ?? ledger.entity.name} detail={`ISO2 ${ledger.entity.iso2 ?? "未知"} · UN M49 ${ledger.entity.m49 ?? "未知"}`} />
          <StatCard label="统计期间" value={<PeriodLabel period={ledger.period} />} detail={`${ledger.period.start} 至 ${ledger.period.end}`} />
          <StatCard label="数据集版本" value={ledger.datasetVersion.version} detail={publicationStatusLabel(ledger.datasetVersion.status)} />
          {ledger.tradeObservations.length > 0 && <StatCard label={`${itemLabel(ledger.product)}贸易观察`} value={ledger.tradeObservations.length} detail="已发布观察" />}
        </div>

        </details>

        <details className="reading-details"><summary>统计口径与资料说明</summary><WarningList warnings={ledger.warnings} /></details>

        {ledger.resolvedMacroIndicators.length > 0 && <details className="section-block detail-collapsible" aria-labelledby="macro-title">
          <summary className="section-heading detail-summary"><div><p className="eyebrow">国家与产业指标</p><h2 id="macro-title">国家与产业指标</h2></div><span className="section-caption">{ledger.resolvedMacroIndicators.length} 项指标 · 展开查看详情</span></summary>
            <div className="metric-list interpreted-metrics">
              {ledger.resolvedMacroIndicators.map(({ observation, definition, source, measurement }) => (
                <article className="metric-row interpreted-metric" key={observation.id}>
                  <div className="metric-main">
                    <span className="card-kicker">{definition.category ?? "宏观指标"}</span>
                    <h3>{definition.label}</h3>
                    {definition.description ? <p>{definition.description}</p> : null}
                    <strong className="metric-value"><ValueDisplay value={measurement.value} status={observation.dataStatus} currency={measurement.currency} unit={measurement.kind === "quantity" ? definition.displayUnit ?? measurement.unit : measurement.unit} /></strong>
                  </div>
                  <div className="fact-metadata-grid">
                    <MetadataItem label="年份/期间" value={<PeriodLabel period={observation.period} />} />
                    {definition.sourceIndicatorCode && <MetadataItem label="来源指标代码" value={definition.sourceIndicatorCode} />}
                    <MetadataItem label="统计概念" value={statisticalConceptLabel(observation.statisticalConcept ?? definition.statisticalConcept)} />
                    {observation.currency && <MetadataItem label="币种" value={observation.currency} />}
                    <MetadataItem label="单位" value={observation.unit ?? <UnknownValue label="未提供" />} />
                    <MetadataItem label="来源" value={source?.name ?? <UnknownValue label="未提供" />} />
                    <MetadataItem label="整理方法" value={dataMethodLabel(observation.method)} />
                    <MetadataItem label="数据版本" value={observation.datasetVersionId ? `${ledger.datasetVersion.version} (${observation.datasetVersionId})` : <UnknownValue label="未提供" />} />
                    <MetadataItem label="数据状态" value={factStatusLabel(observation.dataStatus)} />
                  </div>
                  <div className="interpretation-notes">
                    {definition.valueMeaning ? <p><strong>数值含义：</strong>{definition.valueMeaning}</p> : null}
                    {definition.formula ? <p><strong>计算公式：</strong>{definition.formula}</p> : null}
                    {observation.notes ? <p><strong>观察说明：</strong>{observation.notes}</p> : null}
                  </div>
                </article>
              ))}
            </div>
        </details>}

        {ledger.resolvedTradeObservations.length > 0 && <details className="section-block detail-collapsible" aria-labelledby="trade-title" open={snapshotMetrics.length === 0}>
          <summary className="section-heading detail-summary"><div><p className="eyebrow">商品贸易记录</p><h2 id="trade-title">
                {itemLabel(ledger.product)} {tradeClassification ? `${tradeClassification.system} ${tradeClassification.version} / ${tradeClassification.code}` : "分类未提供"} 进出口观察
              </h2></div><span className="section-caption">{ledger.resolvedTradeObservations.length} 条观察</span></summary>
            <div className="trade-observation-list">
              {ledger.resolvedTradeObservations.map((view) => {
                const observation = view.observation;
                const partner = view.partnerScope === "world_total" ? (
                  <span>
                    世界总计

                  </span>
                ) : view.partner ? (
                        <Link className="text-link" href={mapPath({ ...pageContext, product: productId, country: view.partner.id, layer: "trade" })}>{view.partner.name}</Link>
                ) : <UnknownValue label="伙伴未提供" />;
                return (
                  <article className="trade-observation-card" key={observation.id}>
                    <div className="trade-observation-heading">
                      <div>
                        <span className={`direction-pill direction-${observation.direction}`}>{observation.direction === "export" ? "出口" : "进口"}</span>
                        <h3>{view.item?.name ?? "未映射商品"}</h3>
                        <p>{view.classification?.system ?? observation.classificationSystem} {view.classification?.version ?? observation.classificationVersion} / {view.classification?.code ?? observation.classificationCode} · {view.classification?.label ?? "分类标签未提供"}</p>
                      </div>
                      <div className="fact-status-stack">

                        <StatusBadge status={view.valueDataStatus} method={observation.method} />
                      </div>
                    </div>
                    <div className="trade-values">
                      <div><span>金额</span><strong><ValueDisplay value={observation.value} status={view.valueDataStatus} currency={observation.currency} /></strong></div>
                      {observation.quantity !== null && <div><span>数量</span><strong><ValueDisplay value={observation.quantity} status={view.quantityDataStatus} unit={observation.unit} /></strong></div>}
                    </div>
                    <details className="reading-details"><summary>来源与统计详情 · {observation.period.label}</summary><div className="fact-metadata-grid">
                      <MetadataItem label="报告国" value={view.reporter?.name ?? <UnknownValue />} />
                      <MetadataItem label="伙伴" value={partner} />
                      <MetadataItem label="期间" value={<PeriodLabel period={observation.period} />} />
                      <MetadataItem label="统计概念" value={statisticalConceptLabel(observation.statisticalConcept)} />
                      {observation.currency && <MetadataItem label="币种" value={observation.currency} />}
                      <MetadataItem label="单位" value={observation.unit ?? <UnknownValue label="未提供" />} />
                      <MetadataItem label="来源" value={view.source?.name ?? <UnknownValue label="未提供" />} />
                      <MetadataItem label="整理方法" value={dataMethodLabel(observation.method)} />
                      <MetadataItem label="数据版本" value={observation.datasetVersionId ? `${ledger.datasetVersion.version} (${observation.datasetVersionId})` : <UnknownValue label="未提供" />} />
                      <MetadataItem label="金额状态" value={factStatusLabel(view.valueDataStatus)} />
                      <MetadataItem label="数量状态" value={factStatusLabel(view.quantityDataStatus)} />
                    </div>
                    </details>
                    {observation.qualityNote ? <details className="quality-details"><summary>查看来源质量标记</summary><code>{observation.qualityNote}</code></details> : null}
                  </article>
                );
              })}
            </div>
          <div className="legend-block"><h3>状态含义</h3><StatusLegend /></div>
        </details>}

        {ledger.relatedNodes.length > 0 && <section className="section-block" aria-labelledby="related-title">
          <div className="section-heading">
            <div><p className="eyebrow">关联阅读</p><h2 id="related-title">关联供应链节点</h2></div>
            <Link className="text-link" href={supplyChainPath(productId, undefined, pageContext)}>查看完整路径 →</Link>
          </div>
            <div className="node-grid compact-grid">
              {ledger.relatedNodes.map((node) => (
                <Link className="node-card" href={nodePath(productId, node.node.id, pageContext)} key={node.node.id}>
                  <span className="node-type">{node.processStage?.label}</span>
                  <h3>{node.node.label}</h3>
                  <p>{itemLabel(node.item) ?? "未知货物"} · {node.processStage?.label ?? "未知环节"}</p>
                  <span className="card-footer">打开节点详情 <span>→</span></span>
                </Link>
              ))}
            </div>
        </section>}
        {ledger.resolvedMacroIndicators.length === 0 && ledger.resolvedTradeObservations.length === 0 && ledger.relatedNodes.length === 0 && <div className="empty-state"><p>当前选择没有匹配的记录。</p><Link className="text-link" href={ledgerPath(productId, entityId)}>查看这个国家的全部时期 →</Link></div>}

        <section className="hierarchy-next-step"><strong>统计详情</strong><span>打开原始资料，了解数据的年份、统计方法与版本。</span><Link className="button button-primary" href={`/products/${productId}/provenance`}>查看来源与版本 →</Link></section>
      </div>
    </SiteShell>
  );
}
