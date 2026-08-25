import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../../lib/data";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../../../../components/site-shell";
import { contextMismatch, readPageContext } from "../../../../../lib/context";
import {
  EvidenceGapRegistry,
  EvidenceLevelBadge,
  MetadataItem,
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
  const overview = queries.getProductOverview(productId);
  const node = queries.getSupplyChainNode(productId, nodeId);
  if (!overview || !node) notFound();
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
          { label: overview.product.name, href: productPath(productId, pageContext) },
          { label: "供应链路径", href: supplyChainPath(productId, undefined, pageContext) },
          { label: node.node.node.label }
        ]} />
        <ContextBanner period={node.node.period.label} datasetVersion={node.datasetVersion.version} contentVersion={node.node.contentVersion?.version} mismatches={contextMismatches} />
        <PageIntro
          eyebrow="Supply-chain node"
          title={node.node.node.label}
          description="节点详情连接代表性流、生产活动、国家实体和来源；它不代表唯一工厂、订单或批次。"
          actions={(
            <>
              {node.node.entity ? <Link className="button button-primary" href={ledgerPath(productId, node.node.entity.id, pageContext)}>打开国家账本</Link> : null}
              <Link className="button button-secondary" href={evidenceGapsPath(productId, pageContext)}>完整证据缺口</Link>
            </>
          )}
        />

        <nav className="exploration-nav" aria-label="节点研究层级">
          <Link href={productPath(productId, pageContext)}>① 商品总览</Link>
          <Link href={supplyChainPath(productId, node.node.item?.id, pageContext)}>② 所属路线</Link>
          <span className="active">③ 节点详情</span>
          <Link href={evidenceGapsPath(productId, pageContext)}>④ 证据与缺口</Link>
        </nav>

        <WarningList warnings={node.warnings} />
        <section className="node-identity-panel">
          <div className="node-identity-main">
            <span className="node-type">{node.node.node.nodeType}</span>
            <h2>{node.node.item?.name ?? <UnknownValue label="未知货物" />}</h2>
            <p>{node.node.processStage?.label ?? <UnknownValue label="未知环节" />}</p>
            {node.node.node.notes ? <p className="node-interpretation-note">{node.node.node.notes}</p> : null}
            <EvidenceLevelBadge level={node.node.evidenceLevel} />
          </div>
          <div className="node-identity-meta">
            <div><span>国家/地区</span><strong>{node.node.entity?.name ?? <UnknownValue />}</strong></div>
            <div><span>ISO</span><strong>{node.node.entity?.iso3 ?? <UnknownValue />}</strong></div>
            <div><span>期间</span><strong><PeriodLabel period={node.node.period} /></strong></div>
            <div><span>method / dataStatus</span><strong><StatusBadge status={node.node.node.dataStatus} method={node.node.node.method} /></strong></div>
            <div><span>datasetVersion</span><strong>{node.node.datasetVersion?.version ?? <UnknownValue label="未提供" />}</strong></div>
            <div><span>contentVersion</span><strong>{node.node.contentVersion?.version ?? <UnknownValue label="未提供" />}</strong></div>
            <div><span>节点来源</span><strong>{node.node.sources.length} 个</strong></div>
            <div><span>节点直接证据</span><strong>{node.node.evidence.length} 条</strong></div>
          </div>
          <NodeFlowSummary node={node} />
        </section>

        <details className="section-block detail-collapsible" aria-labelledby="incoming-title" open>
          <summary className="section-heading detail-summary"><div><p className="eyebrow">Inbound relations</p><h2 id="incoming-title">进入节点的流</h2></div><span className="section-caption">{node.incomingFlows.length} 条连接 · 点击展开</span></summary>
          <FlowTable flows={node.incomingFlows} productId={productId} context={pageContext} />
        </details>

        <details className="section-block detail-collapsible" aria-labelledby="outgoing-title">
          <summary className="section-heading detail-summary"><div><p className="eyebrow">Outbound relations</p><h2 id="outgoing-title">离开节点的流</h2></div><span className="section-caption">{node.outgoingFlows.length} 条连接 · 点击展开</span></summary>
          <FlowTable flows={node.outgoingFlows} productId={productId} context={pageContext} />
        </details>

        <details className="section-block detail-collapsible" aria-labelledby="activities-title">
          <summary className="section-heading detail-summary"><div><p className="eyebrow">Production activities</p><h2 id="activities-title">生产活动</h2></div><span className="section-caption">{node.productionActivities.length} 条活动 · 结构化示意</span></summary>
          {node.productionActivities.length === 0 ? <div className="empty-state">当前节点没有单独记录的生产活动。</div> : (
            <div className="activity-list">
              {node.productionActivities.map((view) => {
                const { activity } = view;
                return (
                <article className="activity-card resolved-activity-card" key={activity.id}>
                  <div>
                    <span className="card-kicker">{view.processStage?.label ?? <UnknownValue label="未知环节" />}</span>
                    <h3>{activity.notes ?? "未提供活动说明"}</h3>
                    <p><PeriodLabel period={activity.period} /></p>
                  </div>
                  <div className="activity-io">
                    <span>输入：{view.inputs.length ? view.inputs.map((item) => item.name).join("、") : "无 / 未提供"}</span>
                    <span>输出：{view.outputs.length ? view.outputs.map((item) => item.name).join("、") : "无 / 未提供"}</span>
                    <MetadataItem label="datasetVersion" value={view.datasetVersion?.version ?? <UnknownValue label="未提供" />} />
                    <MetadataItem label="contentVersion" value={view.contentVersion?.version ?? <UnknownValue label="未提供" />} />
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

        <section className="hierarchy-card node-next-layer"><strong>证据摘要</strong><span>{node.evidence.length} 条证据、{node.node.sources.length} 个节点来源已关联。完整定位、来源元数据和证据范围在下一层查看。</span><Link className="button button-secondary" href={evidenceGapsPath(productId, pageContext)}>查看证据与缺口 →</Link></section>

        <details className="section-block detail-collapsible" aria-labelledby="node-gaps-title">
          <summary className="section-heading detail-summary"><div><p className="eyebrow">Evidence gaps</p><h2 id="node-gaps-title">节点及相邻连接的证据缺口</h2></div><span className="section-caption">{node.evidenceGaps.length} 条缺口 · 角色证据不会自动升级边</span></summary>
          <EvidenceGapRegistry gaps={node.evidenceGaps} />
        </details>

        <section className="hierarchy-next-step"><strong>下一层</strong><span>查看国家账本、来源许可证、版本和完整证据定位。</span>{node.node.entity ? <Link className="button button-primary" href={ledgerPath(productId, node.node.entity.id, pageContext)}>打开国家账本 →</Link> : <Link className="button button-primary" href={evidenceGapsPath(productId, pageContext)}>打开证据登记册 →</Link>}</section>
      </div>
    </SiteShell>
  );
}
