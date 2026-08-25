import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../../lib/data";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../../../../components/site-shell";
import { contextMismatch, readPageContext } from "../../../../../lib/context";
import {
  MetadataItem,
  PeriodLabel,
  StatCard,
  StatusBadge,
  StatusLegend,
  UnknownValue,
  ValueDisplay,
  WarningList
} from "../../../../../components/data-display";
import { ledgerPath, nodePath, productPath, supplyChainPath } from "../../../../../lib/paths";

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
    granularity: overview.period.granularity,
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

  return (
    <SiteShell>
      <div className="content-column wide-column">
        <Breadcrumbs items={[
          { label: "商品目录", href: "/products" },
          { label: overview.product.name, href: productPath(productId, pageContext) },
          { label: "国家贸易账本" },
          { label: ledger.entity.name }
        ]} />
        <ContextBanner period={ledger.period.label} datasetVersion={ledger.datasetVersion.version} contentVersion={provenance.route.contentVersion?.version} mismatches={contextMismatches} />
        <PageIntro
          eyebrow="Country trade ledger"
          title={`${ledger.entity.name} · 国家账本`}
          description="宏观商品贸易、官方储备与 HS 单品海关观察按各自统计口径展示。没有观察不补零，海关贸易金额也不解释为企业利润、成本或手机价格。"
          actions={<Link className="button button-secondary" href={firstRelatedNode ? nodePath(productId, firstRelatedNode.node.id, pageContext) : supplyChainPath(productId, undefined, pageContext)}>返回节点路径</Link>}
        />

        <nav className="exploration-nav" aria-label="国家研究层级">
          <Link href={productPath(productId, pageContext)}>① 商品总览</Link>
          <Link href={supplyChainPath(productId, undefined, pageContext)}>② 供应链路线</Link>
          <span className="active">③ 国家账本</span>
          <Link href={ledger.relatedNodes[0] ? nodePath(productId, ledger.relatedNodes[0].node.id, pageContext) : supplyChainPath(productId, undefined, pageContext)}>④ 相关节点</Link>
        </nav>

        <div className="stat-grid">
          <StatCard label="国家/地区代码" value={ledger.entity.iso3 ?? ledger.entity.name} detail={`ISO2 ${ledger.entity.iso2 ?? "未知"} · UN M49 ${ledger.entity.m49 ?? "未知"}`} />
          <StatCard label="统计期间" value={<PeriodLabel period={ledger.period} />} detail={`${ledger.period.start} 至 ${ledger.period.end}`} />
          <StatCard label="数据集版本" value={ledger.datasetVersion.version} detail={ledger.datasetVersion.status} />
          <StatCard label={`${ledger.product.name}贸易观察`} value={ledger.tradeObservations.length} detail={ledger.tradeAvailability === "available" ? "已发布观察" : "未知，不是零"} />
        </div>

        <WarningList warnings={ledger.warnings} />

        <details className="section-block detail-collapsible" aria-labelledby="macro-title" open>
          <summary className="section-heading detail-summary"><div><p className="eyebrow">Macro ledger</p><h2 id="macro-title">国家宏观贸易账本</h2></div><span className="section-caption">{ledger.resolvedMacroIndicators.length} 项摘要指标 · 统计详情可展开</span></summary>
          {ledger.resolvedMacroIndicators.length === 0 ? <div className="empty-state">当前期间没有已发布的宏观指标。</div> : (
            <div className="metric-list interpreted-metrics">
              {ledger.resolvedMacroIndicators.map(({ observation, definition, source }) => (
                <article className="metric-row interpreted-metric" key={observation.id}>
                  <div className="metric-main">
                    <span className="card-kicker">{definition.category ?? "宏观指标"}</span>
                    <h3>{definition.label}</h3>
                    {definition.description ? <p>{definition.description}</p> : null}
                    <strong className="metric-value"><ValueDisplay value={observation.value} status={observation.dataStatus} currency={observation.currency} unit={observation.unit} /></strong>
                  </div>
                  <div className="fact-metadata-grid">
                    <MetadataItem label="年份/期间" value={<PeriodLabel period={observation.period} />} />
                    <MetadataItem label="来源指标代码" value={definition.sourceIndicatorCode ?? <UnknownValue label="未提供" />} />
                    <MetadataItem label="统计概念" value={statisticalConceptLabel(observation.statisticalConcept ?? definition.statisticalConcept)} />
                    <MetadataItem label="币种" value={observation.currency ?? <UnknownValue label="未提供" />} />
                    <MetadataItem label="单位" value={observation.unit ?? <UnknownValue label="未提供" />} />
                    <MetadataItem label="来源" value={source?.name ?? <UnknownValue label="未提供" />} />
                    <MetadataItem label="method" value={observation.method} />
                    <MetadataItem label="datasetVersion" value={observation.datasetVersionId ? `${ledger.datasetVersion.version} (${observation.datasetVersionId})` : <UnknownValue label="未提供" />} />
                    <MetadataItem label="dataStatus" value={<StatusBadge status={observation.dataStatus} />} />
                  </div>
                  <div className="interpretation-notes">
                    {definition.valueMeaning ? <p><strong>数值含义：</strong>{definition.valueMeaning}</p> : null}
                    {definition.formula ? <p><strong>计算公式：</strong>{definition.formula}</p> : null}
                    {observation.notes ? <p><strong>观察说明：</strong>{observation.notes}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </details>

        <details className="section-block detail-collapsible" aria-labelledby="trade-title" open>
          <summary className="section-heading detail-summary"><div><p className="eyebrow">Product trade observations</p><h2 id="trade-title">
                {ledger.product.name} {tradeClassification ? `${tradeClassification.system} ${tradeClassification.version} / ${tradeClassification.code}` : "分类未提供"} 进出口观察
              </h2></div><span className="section-caption">{ledger.resolvedTradeObservations.length} 条观察 · unknown 不等于 0</span></summary>
          {ledger.resolvedTradeObservations.length === 0 ? (
            <div className="empty-state missing-observation">
              <strong>当前期间没有已发布的{ledger.product.name}贸易观察。</strong>
              <p>{ledger.tradeAvailabilityNote}</p>
              <p>本数据切片不会为没有返回记录的国家生成数值为 0 的行。</p>
            </div>
          ) : (
            <div className="trade-observation-list">
              {ledger.resolvedTradeObservations.map((view) => {
                const observation = view.observation;
                const partner = view.partnerScope === "world_total" ? (
                  <span>
                    世界总计
                    <small className="block-note">
                      {observation.partnerCode === null || observation.partnerCode === undefined
                        ? "来源伙伴代码未提供"
                        : `partnerCode=${observation.partnerCode}，不是具体国家`}
                    </small>
                  </span>
                ) : view.partner ? (
                        <Link className="text-link" href={ledgerPath(productId, view.partner.id, pageContext)}>{view.partner.name}</Link>
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
                        <small>金额状态</small>
                        <StatusBadge status={view.valueDataStatus} method={observation.method} />
                      </div>
                    </div>
                    <div className="trade-values">
                      <div><span>金额</span><strong><ValueDisplay value={observation.value} status={view.valueDataStatus} currency={observation.currency} /></strong></div>
                      <div><span>数量</span><strong><ValueDisplay value={observation.quantity} status={view.quantityDataStatus} unit={observation.unit} /></strong></div>
                    </div>
                    <div className="fact-metadata-grid">
                      <MetadataItem label="报告国" value={view.reporter?.name ?? <UnknownValue />} />
                      <MetadataItem label="伙伴" value={partner} />
                      <MetadataItem label="期间" value={<PeriodLabel period={observation.period} />} />
                      <MetadataItem label="统计概念" value={statisticalConceptLabel(observation.statisticalConcept)} />
                      <MetadataItem label="币种" value={observation.currency ?? <UnknownValue label="未提供" />} />
                      <MetadataItem label="单位" value={observation.unit ?? <UnknownValue label="未提供" />} />
                      <MetadataItem label="来源" value={view.source?.name ?? <UnknownValue label="未提供" />} />
                      <MetadataItem label="method" value={observation.method} />
                      <MetadataItem label="datasetVersion" value={observation.datasetVersionId ? `${ledger.datasetVersion.version} (${observation.datasetVersionId})` : <UnknownValue label="未提供" />} />
                      <MetadataItem label="金额 dataStatus" value={<StatusBadge status={view.valueDataStatus} />} />
                      <MetadataItem label="数量 dataStatus" value={<StatusBadge status={view.quantityDataStatus} />} />
                    </div>
                    {observation.qualityNote ? <details className="quality-details"><summary>查看来源质量标记</summary><code>{observation.qualityNote}</code></details> : null}
                  </article>
                );
              })}
            </div>
          )}
          <div className="legend-block"><h3>状态含义</h3><StatusLegend /></div>
        </details>

        <section className="section-block" aria-labelledby="related-title">
          <div className="section-heading">
            <div><p className="eyebrow">Cross-module context</p><h2 id="related-title">关联供应链节点</h2></div>
            <Link className="text-link" href={supplyChainPath(productId, undefined, pageContext)}>查看完整路径 →</Link>
          </div>
          {ledger.relatedNodes.length === 0 ? <div className="empty-state">当前国家没有关联的代表性节点。</div> : (
            <div className="node-grid compact-grid">
              {ledger.relatedNodes.map((node) => (
                <Link className="node-card" href={nodePath(productId, node.node.id, pageContext)} key={node.node.id}>
                  <span className="node-type">{node.node.nodeType}</span>
                  <h3>{node.node.label}</h3>
                  <p>{node.item?.name ?? "未知货物"} · {node.processStage?.label ?? "未知环节"}</p>
                  <span className="card-footer">打开节点详情 <span>→</span></span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="hierarchy-next-step"><strong>统计详情</strong><span>来源指标代码、许可证、method、数据状态和版本信息集中在来源页面。</span><Link className="button button-primary" href={`/products/${productId}/provenance`}>查看来源与版本 →</Link></section>
      </div>
    </SiteShell>
  );
}
