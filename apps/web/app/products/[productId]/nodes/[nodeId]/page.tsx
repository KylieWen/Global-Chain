import { itemLabel } from "../../../../../lib/item-label";
import { ProductNavigation } from "../../../../../components/product-navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../../lib/data";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../../../../components/site-shell";
import { contextMismatch, readPageContext } from "../../../../../lib/context";
import {
  EvidenceGapRegistry,
  EvidenceLevelBadge,
  PeriodLabel,
  ResolvedEvidenceList,
  StatusBadge,
  UnknownValue,
  WarningList
} from "../../../../../components/data-display";
import { FlowTable, NodeFlowSummary } from "../../../../../components/flow-table";
import { evidenceGapsPath, ledgerPath, productPath, supplyChainPath } from "../../../../../lib/paths";

export default async function SupplyChainNodePage({
  params,
  searchParams
}: {
  params: Promise<{ productId: string; nodeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { productId, nodeId } = await params;
  const pageContext = readPageContext(await searchParams);
  const queries = await getQueryService(pageContext.datasetVersion);
  const routeContext = { datasetVersion: pageContext.datasetVersion, contentVersion: pageContext.contentVersion };
  const overview = queries.getProductOverview(productId);
  const node = queries.getSupplyChainNode(productId, nodeId);
  if (!overview || !node) notFound();
  const hasLedger=queries.listCountries().some(country=>country.entity.id===node.node.entity?.id&&country.ledgerProductIds.includes(productId));
  const contextMismatches = contextMismatch(pageContext, {
    period: node.node.period.label,
    datasetVersion: node.datasetVersion.version,
    contentVersion: node.node.contentVersion?.version
  });


  return (
    <SiteShell>
      <div className="content-column wide-column">
        <Breadcrumbs items={[
          { label: "商品目录", href: "/products" },
          { label: itemLabel(overview.product), href: productPath(productId, pageContext) },
          { label: "供应链路径", href: supplyChainPath(productId, undefined, routeContext) },
          { label: node.node.node.label }
        ]} />
        <ContextBanner period={node.node.period.label} datasetVersion={node.datasetVersion.version} contentVersion={node.node.contentVersion?.version} mismatches={contextMismatches} />
        <PageIntro
          eyebrow="供应链环节"
          title={node.node.node.label}
          description="查看这个环节用到什么、产出什么，以及它连接的上下游。"
          actions={(
            <>
              {node.node.entity && hasLedger ? <Link className="button button-primary" href={ledgerPath(productId, node.node.entity.id, pageContext)}>打开国家账本</Link> : null}
              <Link className="button button-secondary" href={evidenceGapsPath(productId, pageContext)}>完整证据缺口</Link>
            </>
          )}
        />

        <ProductNavigation productId={productId} context={routeContext} active="route" hasIndustry={Boolean(queries.getIndustryNetwork(productId))} hasMaterials={queries.getMaterialTradeObservations(productId).length>0}/>

        {node.warnings.length > 0 && <details className="detail-collapsible compact-detail">
          <summary className="detail-summary"><strong>节点阅读提示</strong><span>{node.warnings.length} 条</span></summary>
          <WarningList warnings={node.warnings} />
        </details>}
        <section className="node-identity-panel">
          <div className="node-identity-main">
            <span className="node-type">{node.node.processStage?.label}</span>
            <h2>{node.node.item ? itemLabel(node.node.item) : <UnknownValue label="未知货物" />}</h2>
            <p>{node.node.processStage?.label ?? <UnknownValue label="未知环节" />}</p>
            {node.node.node.notes ? <details className="reading-details"><summary>环节资料说明</summary><p>{node.node.node.notes}</p></details> : null}
            <EvidenceLevelBadge level={node.node.evidenceLevel} />
          </div>
          <div className="node-identity-meta">
            <div><span>国家/地区</span><strong>{node.node.entity?.name ?? <UnknownValue />}</strong></div>
            <div><span>ISO</span><strong>{node.node.entity?.iso3 ?? <UnknownValue />}</strong></div>
            <div><span>期间</span><strong><PeriodLabel period={node.node.period} /></strong></div>



            <div><span>节点来源</span><strong>{node.node.sources.length} 个</strong></div>
          </div>
          <NodeFlowSummary node={node} />
        </section>

        {node.incomingFlows.length > 0 && <details className="section-block detail-collapsible" aria-labelledby="incoming-title" open>
          <summary className="section-heading detail-summary"><div><p className="eyebrow">上游连接</p><h2 id="incoming-title">上游从哪里来</h2></div><span className="section-caption">{node.incomingFlows.length} 条连接 · 点击展开</span></summary>
          <FlowTable flows={node.incomingFlows} productId={productId} context={pageContext} />
        </details>

        }
        {node.outgoingFlows.length > 0 && <details className="section-block detail-collapsible" aria-labelledby="outgoing-title" open>
          <summary className="section-heading detail-summary"><div><p className="eyebrow">下游连接</p><h2 id="outgoing-title">下游到哪里去</h2></div><span className="section-caption">{node.outgoingFlows.length} 条连接 · 点击展开</span></summary>
          <FlowTable flows={node.outgoingFlows} productId={productId} context={pageContext} />
        </details>

        }
        {node.productionActivities.length > 0 && <details className="section-block detail-collapsible" aria-labelledby="activities-title" open>
          <summary className="section-heading detail-summary"><div><p className="eyebrow">生产活动</p><h2 id="activities-title">生产活动</h2></div><span className="section-caption">{node.productionActivities.length} 项</span></summary>
          {node.productionActivities.length === 0 ? <div className="empty-state">当前节点没有单独记录的生产活动。</div> : (
            <div className="activity-list">
              {node.productionActivities.map((view) => {
                const { activity } = view;
                return (
                <article className="activity-card resolved-activity-card" key={activity.id}>
                  <div>
                    <span className="card-kicker">{view.processStage?.label ?? <UnknownValue label="未知环节" />}</span>
                    <h3>{activity.notes ?? view.processStage?.label}</h3>
                    <p><PeriodLabel period={activity.period} /></p>
                  </div>
                  <div className="activity-io">
                    {view.inputs.length > 0 && <span>投入：{view.inputs.map((item) => item.name).join("、")}</span>}
                    {view.outputs.length > 0 && <span>产出：{view.outputs.map((item) => item.name).join("、")}</span>}


                  </div>
                  <div className="activity-status-stack">
                    <EvidenceLevelBadge level={view.evidenceLevel} />
                    <StatusBadge status={activity.dataStatus} method={activity.method} />
                    <details className="evidence-details activity-evidence-details">
                      <summary>{view.evidence.length} 条直接证据</summary>
                      <ResolvedEvidenceList evidence={view.evidence} compact />
                    </details>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </details>

        }

        {node.evidence.length > 0 && <details className="section-block detail-collapsible"><summary className="detail-summary"><strong>资料来源</strong><span>{node.evidence.length} 条记录</span></summary><ResolvedEvidenceList evidence={node.evidence} compact /></details>}

        {node.evidenceGaps.length > 0 && <details className="section-block detail-collapsible" aria-labelledby="node-gaps-title">
          <summary className="section-heading detail-summary"><div><p className="eyebrow">研究记录</p><h2 id="node-gaps-title">相关研究记录</h2></div><span className="section-caption">{node.evidenceGaps.length} 条</span></summary>
          <EvidenceGapRegistry gaps={node.evidenceGaps} />
        </details>}

        <section className="hierarchy-next-step"><strong>下一层</strong><span>继续查看相关国家的进出口和贸易伙伴。</span>{node.node.entity && hasLedger ? <Link className="button button-primary" href={ledgerPath(productId, node.node.entity.id, pageContext)}>打开国家账本 →</Link> : <Link className="button button-primary" href={evidenceGapsPath(productId, pageContext)}>打开证据登记册 →</Link>}</section>
      </div>
    </SiteShell>
  );
}
