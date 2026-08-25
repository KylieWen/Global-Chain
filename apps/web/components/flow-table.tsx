import Link from "next/link";
import type {
  ResolvedSupplyFlowView,
  SupplyChainNodeView
} from "@globe-chain/domain";
import {
  EvidenceLevelBadge,
  MetadataItem,
  PeriodLabel,
  ResolvedEvidenceList,
  StatusBadge,
  UnknownValue,
  ValueDisplay
} from "./data-display";
import { ledgerPath, nodePath } from "../lib/paths";

export function FlowTable({
  flows,
  productId
}: {
  flows: readonly ResolvedSupplyFlowView[];
  productId: string;
}) {
  if (flows.length === 0) {
    return <div className="empty-state">当前筛选下没有已发布的供应链流。</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table supply-flow-table">
        <thead>
          <tr>
            <th>从 / 到</th>
            <th>货物与环节</th>
            <th>路线性质</th>
            <th>数量</th>
            <th>期间与状态</th>
            <th>版本与证据</th>
          </tr>
        </thead>
        <tbody>
          {flows.map((view) => (
            <tr key={view.flow.id}>
              <td>
                <div className="flow-endpoints">
                  <span><small>从</small><EndpointLink endpoint={view.from} productId={productId} /></span>
                  <span aria-hidden="true">→</span>
                  <span><small>到</small><EndpointLink endpoint={view.to} productId={productId} /></span>
                </div>
              </td>
              <td>
                <div className="flow-primary">
                  <strong>{view.item?.name ?? <UnknownValue />}</strong>
                  <span>{view.processStage?.label ?? <UnknownValue />}</span>
                  <small>{view.flow.relationType} · {view.flow.flowKind}</small>
                </div>
              </td>
              <td>
                <div className="flow-badge-stack">
                  <EvidenceLevelBadge level={view.evidenceLevel} />
                  <small>{view.evidenceLevel.description}</small>
                </div>
              </td>
              <td>
                <div className="flow-value-stack">
                  <strong>
                    <ValueDisplay
                      value={view.flow.quantity}
                      status={view.quantityDataStatus}
                      unit={view.flow.unit}
                      unknownLabel="未提供 / 未知"
                    />
                  </strong>
                  <StatusBadge status={view.quantityDataStatus} />
                </div>
              </td>
              <td>
                <div className="flow-meta-stack">
                  <PeriodLabel period={view.flow.period} />
                  <StatusBadge status={view.flow.dataStatus} method={view.flow.method} />
                </div>
              </td>
              <td>
                <div className="flow-version-stack">
                  <MetadataItem
                    label="datasetVersion"
                    value={view.datasetVersion?.version ?? view.flow.datasetVersionId ?? <UnknownValue label="未提供" />}
                  />
                  <MetadataItem
                    label="contentVersion"
                    value={view.contentVersion?.version ?? view.flow.contentVersionId ?? <UnknownValue label="未提供" />}
                  />
                  <details className="evidence-details">
                    <summary>{view.evidence.length} 条证据 · {view.sources.length} 个来源</summary>
                    <ResolvedEvidenceList evidence={view.evidence} compact />
                  </details>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointLink({
  endpoint,
  productId
}: {
  endpoint: ResolvedSupplyFlowView["from"];
  productId: string;
}) {
  if (endpoint.node) {
    return <Link className="text-link" href={nodePath(productId, endpoint.node.node.id)}>{endpoint.node.node.label}</Link>;
  }
  return endpoint.entity ? (
    <Link className="text-link" href={ledgerPath(productId, endpoint.entity.id)}>{endpoint.entity.name}</Link>
  ) : <UnknownValue label={endpoint.referenceId} />;
}

export function NodeFlowSummary({ node }: { node: SupplyChainNodeView }) {
  return (
    <div className="node-flow-summary">
      <div>
        <span className="stat-label">进入流</span>
        <strong>{node.incomingFlows.length}</strong>
      </div>
      <div>
        <span className="stat-label">离开流</span>
        <strong>{node.outgoingFlows.length}</strong>
      </div>
      <div>
        <span className="stat-label">生产活动</span>
        <strong>{node.productionActivities.length}</strong>
      </div>
      <div>
        <span className="stat-label">精确关联证据</span>
        <strong>{node.evidence.length}</strong>
      </div>
    </div>
  );
}
