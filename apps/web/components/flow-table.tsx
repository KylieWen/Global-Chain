import Link from "next/link";
import type {
  ResolvedSupplyFlowView,
  SupplyChainNodeView
} from "@globe-chain/domain";
import { PeriodLabel, StatusBadge, UnknownValue } from "./data-display";
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
      <table className="data-table">
        <thead>
          <tr>
            <th>从</th>
            <th>到</th>
            <th>货物</th>
            <th>环节</th>
            <th>期间</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {flows.map((view) => (
            <tr key={view.flow.id}>
              <td><EndpointLink endpoint={view.from} productId={productId} /></td>
              <td><EndpointLink endpoint={view.to} productId={productId} /></td>
              <td>{view.item?.name ?? <UnknownValue />}</td>
              <td>{view.processStage?.label ?? <UnknownValue />}</td>
              <td><PeriodLabel period={view.flow.period} /></td>
              <td><StatusBadge status={view.flow.dataStatus} method={view.flow.method} /></td>
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
    </div>
  );
}
