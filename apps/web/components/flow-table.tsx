import Link from "next/link";
import type { ResolvedSupplyFlowView, SupplyChainNodeView } from "@globe-chain/domain";
import { EvidenceLevelBadge, PeriodLabel, ResolvedEvidenceList, ValueDisplay } from "./data-display";
import { ledgerPath, nodePath } from "../lib/paths";
import type { PageContext } from "../lib/context";

export function FlowTable({ flows, productId, context }: { flows: readonly ResolvedSupplyFlowView[]; productId: string; context?: PageContext }) {
  if (flows.length === 0) return null;
  const hasQuantities = flows.some(({ flow }) => flow.quantity !== null && flow.quantity !== undefined);
  return <div className="table-wrap"><table className="data-table supply-flow-table">
    <thead><tr><th>从 / 到</th><th>货物与环节</th>{hasQuantities && <th>数量</th>}<th>期间</th><th>资料</th></tr></thead>
    <tbody>{flows.map(view => <tr key={view.flow.id}>
      <td><div className="flow-endpoints"><EndpointLink endpoint={view.from} productId={productId} context={context} /><span aria-hidden="true">→</span><EndpointLink endpoint={view.to} productId={productId} context={context} /></div></td>
      <td><div className="flow-primary"><strong>{view.item?.name}</strong>{view.processStage && <span>{view.processStage.label}</span>}<EvidenceLevelBadge level={view.evidenceLevel} /></div></td>
      {hasQuantities && <td><ValueDisplay value={view.flow.quantity} status={view.quantityDataStatus} unit={view.flow.unit} unknownLabel="—" /></td>}
      <td><PeriodLabel period={view.flow.period} /></td>
      <td><details className="evidence-details"><summary>{view.sources.length} 个来源</summary>
        <ResolvedEvidenceList evidence={view.evidence} compact />
        <small>{view.evidenceLevel.description}</small>
        <p className="muted">数据版本 {view.datasetVersion?.version ?? view.flow.datasetVersionId}{view.contentVersion ? ` · 路线版本 ${view.contentVersion.version}` : ""}</p>
      </details></td>
    </tr>)}</tbody>
  </table></div>;
}
function EndpointLink({ endpoint, productId, context }: { endpoint: ResolvedSupplyFlowView["from"]; productId: string; context?: PageContext }) {
  if (endpoint.node) return <Link className="text-link" href={nodePath(productId, endpoint.node.node.id, context)}>{endpoint.node.node.label}</Link>;
  return endpoint.entity ? <Link className="text-link" href={ledgerPath(productId, endpoint.entity.id, context)}>{endpoint.entity.name}</Link> : <span>{endpoint.referenceId}</span>;
}
export function NodeFlowSummary({ node }: { node: SupplyChainNodeView }) {
  return <div className="node-flow-summary">
    {node.incomingFlows.length > 0 && <div><span className="stat-label">上游连接</span><strong>{node.incomingFlows.length}</strong></div>}
    {node.outgoingFlows.length > 0 && <div><span className="stat-label">下游连接</span><strong>{node.outgoingFlows.length}</strong></div>}
    {node.productionActivities.length > 0 && <div><span className="stat-label">生产活动</span><strong>{node.productionActivities.length}</strong></div>}
  </div>;
}
