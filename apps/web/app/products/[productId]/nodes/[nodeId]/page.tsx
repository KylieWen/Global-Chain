import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../../../../components/site-shell";
import {
  PeriodLabel,
  ProvenancePanel,
  StatusBadge,
  UnknownValue,
  WarningList
} from "../../../../../components/data-display";
import { FlowTable, NodeFlowSummary } from "../../../../../components/flow-table";
import { ledgerPath, productPath, supplyChainPath } from "../../../../../lib/paths";

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

  const nodeProvenance = {
    datasetVersion: node.datasetVersion,
    sources: node.sources,
    evidence: node.evidence,
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
          actions={node.node.entity ? <Link className="button button-primary" href={ledgerPath(productId, node.node.entity.id)}>打开国家账本</Link> : undefined}
        />

        <WarningList warnings={node.warnings} />
        <section className="node-identity-panel">
          <div className="node-identity-main">
            <span className="node-type">{node.node.node.nodeType}</span>
            <h2>{node.node.item?.name ?? <UnknownValue label="未知货物" />}</h2>
            <p>{node.node.processStage?.label ?? <UnknownValue label="未知环节" />}</p>
          </div>
          <div className="node-identity-meta">
            <div><span>国家/地区</span><strong>{node.node.entity?.name ?? <UnknownValue />}</strong></div>
            <div><span>ISO</span><strong>{node.node.entity?.iso3 ?? <UnknownValue />}</strong></div>
            <div><span>期间</span><strong><PeriodLabel period={overview.period} /></strong></div>
            <div><span>状态</span><strong><StatusBadge status={node.node.node.dataStatus} method={node.node.node.method} /></strong></div>
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
              {node.productionActivities.map((activity) => (
                <article className="activity-card" key={activity.id}>
                  <div>
                    <span className="card-kicker">{activity.processStageId}</span>
                    <h3>{activity.notes ?? "未提供活动说明"}</h3>
                    <p><PeriodLabel period={activity.period} /></p>
                  </div>
                  <div className="activity-io">
                    <span>输入：{activity.inputItemIds.length ? activity.inputItemIds.join("、") : "无 / 未提供"}</span>
                    <span>输出：{activity.outputItemIds.length ? activity.outputItemIds.join("、") : "无 / 未提供"}</span>
                  </div>
                  <StatusBadge status={activity.dataStatus} method={activity.method} />
                </article>
              ))}
            </div>
          )}
        </section>

        <ProvenancePanel provenance={nodeProvenance} />
      </div>
    </SiteShell>
  );
}
