import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../../../../components/site-shell";
import {
  EvidenceGapRegistry,
  EvidenceLevelBadge,
  MetadataItem,
  PeriodLabel,
  ProvenancePanel,
  ResolvedEvidenceList,
  StatusBadge,
  UnknownValue,
  WarningList
} from "../../../../../components/data-display";
import { FlowTable, NodeFlowSummary } from "../../../../../components/flow-table";
import { evidenceGapsPath, ledgerPath, productPath, supplyChainPath } from "../../../../../lib/paths";

export default async function SupplyChainNodePage({
  params
}: {
  params: Promise<{ productId: string; nodeId: string }>;
}) {
  const { productId, nodeId } = await params;
  const queries = await getQueryService();
  const overview = queries.getProductOverview(productId);
  const node = queries.getSupplyChainNode(productId, nodeId);
  if (!overview || !node) notFound();

  const contentVersionsById = new Map<
    string,
    NonNullable<typeof node.node.contentVersion>
  >();
  for (const version of [
    node.node.contentVersion,
    ...node.incomingFlows.map((flow) => flow.contentVersion),
    ...node.outgoingFlows.map((flow) => flow.contentVersion),
    ...node.productionActivities.map((activity) => activity.contentVersion)
  ]) {
    if (version) contentVersionsById.set(version.id, version);
  }
  const nodeProvenance = {
    datasetVersion: node.datasetVersion,
    contentVersions: [...contentVersionsById.values()],
    sources: node.sources,
    evidence: node.evidence.map((record) => record.evidence),
    resolvedEvidence: node.evidence,
    evidenceGaps: node.evidenceGaps,
    warnings: node.warnings
  };

  return (
    <SiteShell>
      <div className="content-column wide-column">
        <Breadcrumbs items={[
          { label: "商品目录", href: "/products" },
          { label: overview.product.name, href: productPath(productId) },
          { label: "供应链路径", href: supplyChainPath(productId) },
          { label: node.node.node.label }
        ]} />
        <PageIntro
          eyebrow="Supply-chain node"
          title={node.node.node.label}
          description="节点详情连接代表性流、生产活动、国家实体和来源；它不代表唯一工厂、订单或批次。"
          actions={(
            <>
              {node.node.entity ? <Link className="button button-primary" href={ledgerPath(productId, node.node.entity.id)}>打开国家账本</Link> : null}
              <Link className="button button-secondary" href={evidenceGapsPath(productId)}>完整证据缺口</Link>
            </>
          )}
        />

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

        <section className="section-block" aria-labelledby="incoming-title">
          <div className="section-heading">
            <div><p className="eyebrow">Inbound relations</p><h2 id="incoming-title">进入节点的流</h2></div>
          </div>
          <FlowTable flows={node.incomingFlows} productId={productId} />
        </section>

        <section className="section-block" aria-labelledby="outgoing-title">
          <div className="section-heading">
            <div><p className="eyebrow">Outbound relations</p><h2 id="outgoing-title">离开节点的流</h2></div>
          </div>
          <FlowTable flows={node.outgoingFlows} productId={productId} />
        </section>

        <section className="section-block" aria-labelledby="activities-title">
          <div className="section-heading">
            <div><p className="eyebrow">Production activities</p><h2 id="activities-title">生产活动</h2></div>
            <span className="section-caption">活动是结构化示意，不是工厂级追踪</span>
          </div>
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
        </section>

        <section className="section-block" aria-labelledby="node-evidence-title">
          <div className="section-heading">
            <div><p className="eyebrow">Evidence scope</p><h2 id="node-evidence-title">节点证据支持范围</h2></div>
            <span className="section-caption">只展示查询层精确关联到本节点、相邻边与活动的证据</span>
          </div>
          <ResolvedEvidenceList evidence={node.evidence} />
        </section>

        <section className="section-block evidence-gap-section" aria-labelledby="node-gaps-title">
          <div className="section-heading">
            <div><p className="eyebrow">Evidence gaps</p><h2 id="node-gaps-title">节点及相邻连接的证据缺口</h2></div>
            <span className="section-caption">角色证据不会自动升级进入或离开节点的边</span>
          </div>
          <EvidenceGapRegistry gaps={node.evidenceGaps} />
        </section>

        <ProvenancePanel provenance={nodeProvenance} />
      </div>
    </SiteShell>
  );
}
