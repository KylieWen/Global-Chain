import Link from "next/link";
import type { SupplyChainStoryView } from "@globe-chain/domain";
import type { PageContext } from "../lib/context";
import { nodePath } from "../lib/paths";

const width = 1180;
const columnWidth = 210;
const rowHeight = 126;

function shortLabel(value: string, length = 19) {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

export function SupplyChainGraph({ story, productId, context }: { story: SupplyChainStoryView; productId: string; context: PageContext }) {
  const stageOrders = [...new Set(story.nodes.map(({ processStage }) => processStage?.order ?? 0))].sort((a, b) => a - b);
  const stageColumn = new Map(stageOrders.map((order, index) => [order, index]));
  const grouped = new Map<number, typeof story.nodes>();
  story.nodes.forEach((node) => {
    const key = stageColumn.get(node.processStage?.order ?? 0) ?? 0;
    grouped.set(key, [...(grouped.get(key) ?? []), node]);
  });
  const positions = new Map<string, { x: number; y: number }>();
  grouped.forEach((nodes, column) => nodes.forEach((node, row) => positions.set(node.node.id, { x: 18 + column * columnWidth, y: 28 + row * rowHeight })));
  const entityNode = new Map<string, string>();
  story.nodes.forEach((node) => { if (node.entity?.id && !entityNode.has(node.entity.id)) entityNode.set(node.entity.id, node.node.id); });
  const endpointNode = (endpoint: typeof story.flows[number]["from"]) => endpoint.node?.node.id ?? (endpoint.entity?.id ? entityNode.get(endpoint.entity.id) : undefined);
  const graphHeight = Math.max(260, Math.max(...[...positions.values()].map(({ y }) => y), 0) + 112);

  return <section className="section-block visual-graph-section" aria-labelledby="visual-graph-title">
    <div className="section-heading"><div><p className="eyebrow">Visual route</p><h2 id="visual-graph-title">供应链路线图</h2></div><span className="section-caption">节点和连接由当前 published 数据集驱动</span></div>
    <div className="route-graph-shell">
      <svg className="route-graph" viewBox={`0 0 ${width} ${graphHeight}`} role="img" aria-label="供应链代表性路线图">
        <defs><marker id="route-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9aa9bf" /></marker></defs>
        {story.flows.map((flow) => {
          const from = endpointNode(flow.from); const to = endpointNode(flow.to);
          if (!from || !to) return null;
          const a = positions.get(from); const b = positions.get(to);
          if (!a || !b) return null;
          return <line key={flow.flow.id} className={`graph-edge graph-edge-${flow.evidenceLevel.code}`} x1={a.x + 176} y1={a.y + 38} x2={b.x} y2={b.y + 38} markerEnd="url(#route-arrow)" />;
        })}
        {stageOrders.map((order, column) => <text key={order} className="graph-stage-label" x={18 + column * columnWidth} y={17}>{story.nodes.find(({ processStage }) => processStage?.order === order)?.processStage?.label ?? `阶段 ${order + 1}`}</text>)}
        {story.nodes.map((node) => {
          const position = positions.get(node.node.id); if (!position) return null;
          return <g key={node.node.id} className="graph-node">
            <rect x={position.x} y={position.y} width="176" height="76" rx="12" />
            <text className="graph-node-country" x={position.x + 12} y={position.y + 20}>{shortLabel(node.entity?.name ?? "未指定地区", 15)}</text>
            <text className="graph-node-label" x={position.x + 12} y={position.y + 42}>{shortLabel(node.item?.name ?? node.node.label)}</text>
            <text className="graph-node-status" x={position.x + 12} y={position.y + 62}>{node.evidenceLevel.label} · {node.node.dataStatus}</text>
            <foreignObject x={position.x} y={position.y} width="176" height="76"><Link className="graph-node-link" href={nodePath(productId, node.node.id, context)} aria-label={`查看 ${node.node.label} 节点详情`} /></foreignObject>
          </g>;
        })}
      </svg>
      <div className="route-graph-note">路线为代表性策展连接；箭头不表示每一件具体手机的唯一真实物流路径。数量未知显示为未知，不等于零。</div>
    </div>
  </section>;
}
