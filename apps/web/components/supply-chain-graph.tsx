"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ResolvedSupplyFlowView, ResolvedStoryNodeView, SupplyChainStoryView } from "@globe-chain/domain";
import type { PageContext } from "../lib/context";
import { nodePath } from "../lib/paths";
import { StatusBadge } from "./data-display";

const width = 1180;
const columnWidth = 210;
const rowHeight = 126;

function shortLabel(value: string, length = 19) {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

export function SupplyChainGraph({ story, productId, context }: { story: SupplyChainStoryView; productId: string; context: PageContext }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<number | null>(null);
  const stageOrders = useMemo(() => [...new Set(story.nodes.map(({ processStage }) => processStage?.order ?? 0))].sort((a, b) => a - b), [story.nodes]);
  const stageInfo = useMemo(() => stageOrders.map((order) => ({ order, label: story.nodes.find(({ processStage }) => processStage?.order === order)?.processStage?.label ?? `阶段 ${order + 1}`, count: story.nodes.filter(({ processStage }) => (processStage?.order ?? 0) === order).length })), [stageOrders, story.nodes]);
  const stageColumn = new Map(stageOrders.map((order, index) => [order, index]));
  const visibleNodes = story.nodes.filter(({ processStage }) => stageFilter === null || (processStage?.order ?? 0) === stageFilter);
  const visibleIds = new Set(visibleNodes.map(({ node }) => node.id));
  const grouped = new Map<number, typeof visibleNodes>();
  visibleNodes.forEach((node) => {
    const key = stageColumn.get(node.processStage?.order ?? 0) ?? 0;
    grouped.set(key, [...(grouped.get(key) ?? []), node]);
  });
  const positions = new Map<string, { x: number; y: number }>();
  grouped.forEach((nodes, column) => nodes.forEach((node, row) => positions.set(node.node.id, { x: 18 + column * columnWidth, y: 28 + row * rowHeight })));
  const entityNode = new Map<string, string>();
  visibleNodes.forEach((node) => { if (node.entity?.id && !entityNode.has(node.entity.id)) entityNode.set(node.entity.id, node.node.id); });
  const endpointNode = (endpoint: typeof story.flows[number]["from"]) => endpoint.node?.node.id ?? (endpoint.entity?.id ? entityNode.get(endpoint.entity.id) : undefined);
  const visibleFlows = story.flows.filter((flow) => {
    const from = endpointNode(flow.from); const to = endpointNode(flow.to);
    return Boolean(from && to && visibleIds.has(from) && visibleIds.has(to));
  });
  const graphHeight = Math.max(260, Math.max(...[...positions.values()].map(({ y }) => y), 0) + 112);
  const selectedNode = story.nodes.find(({ node }) => node.id === selectedNodeId) ?? null;
  const selectedFlow = story.flows.find(({ flow }) => flow.id === selectedFlowId) ?? null;

  return <section className="section-block visual-graph-section" aria-labelledby="visual-graph-title">
    <div className="section-heading"><div><p className="eyebrow">Visual route</p><h2 id="visual-graph-title">供应链路线图</h2></div><span className="section-caption">点击节点或连接查看解释</span></div>
    <div className="graph-filter-bar" aria-label="阶段筛选">
      <div className="graph-filter-title"><strong>按阶段探索</strong><span>选择一个阶段聚焦查看节点</span></div>
      <div className="graph-filter-options">
        <button aria-pressed={stageFilter === null} className={stageFilter === null ? "filter-chip active" : "filter-chip"} onClick={() => setStageFilter(null)}>全部阶段 <small>{story.nodes.length}</small></button>
        {stageInfo.map(({ order, label, count }) => <button aria-pressed={stageFilter === order} key={order} className={stageFilter === order ? "filter-chip active" : "filter-chip"} onClick={() => setStageFilter(order)}>{label} <small>{count}</small></button>)}
      </div>
      <span className="filter-note">{stageFilter === null ? "完整路线" : `当前聚焦：${stageInfo.find((stage) => stage.order === stageFilter)?.label ?? "当前阶段"}`}</span>
    </div>
    <div className="route-graph-shell">
      <svg className="route-graph" viewBox={`0 0 ${width} ${graphHeight}`} role="img" aria-label="供应链代表性路线图">
        <defs><marker id="route-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9aa9bf" /></marker></defs>
        {visibleFlows.map((flow) => {
          const from = endpointNode(flow.from); const to = endpointNode(flow.to);
          const a = from ? positions.get(from) : undefined; const b = to ? positions.get(to) : undefined;
          if (!a || !b) return null;
          const selected = selectedFlowId === flow.flow.id;
          return <g key={flow.flow.id} className={selected ? "graph-edge-group selected" : "graph-edge-group"} onClick={() => { setSelectedFlowId(flow.flow.id); setSelectedNodeId(null); }} role="button" tabIndex={0} aria-label={`查看连接 ${flow.item?.name ?? "未知货物"}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedFlowId(flow.flow.id); }}>
            <line className={`graph-edge graph-edge-${flow.evidenceLevel.code}`} x1={a.x + 176} y1={a.y + 38} x2={b.x} y2={b.y + 38} markerEnd="url(#route-arrow)" /><line className="graph-edge-hit-area" x1={a.x + 176} y1={a.y + 38} x2={b.x} y2={b.y + 38} />
          </g>;
        })}
        {stageOrders.map((order, column) => <text key={order} className="graph-stage-label" x={18 + column * columnWidth} y={17}>{story.nodes.find(({ processStage }) => processStage?.order === order)?.processStage?.label ?? `阶段 ${order + 1}`}</text>)}
        {visibleNodes.map((node) => {
          const position = positions.get(node.node.id); if (!position) return null;
          const selected = selectedNodeId === node.node.id;
          return <g key={node.node.id} className={selected ? "graph-node selected" : "graph-node"} onClick={() => { setSelectedNodeId(node.node.id); setSelectedFlowId(null); }} role="button" tabIndex={0} aria-label={`查看 ${node.node.label}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedNodeId(node.node.id); }}>
            <rect x={position.x} y={position.y} width="176" height="76" rx="12" /><text className="graph-node-country" x={position.x + 12} y={position.y + 20}>{shortLabel(node.entity?.name ?? "未指定地区", 15)}</text><text className="graph-node-label" x={position.x + 12} y={position.y + 42}>{shortLabel(node.item?.name ?? node.node.label)}</text><text className="graph-node-status" x={position.x + 12} y={position.y + 62}>{node.evidenceLevel.label} · {node.node.dataStatus}</text>
          </g>;
        })}
      </svg>
      <div className="route-graph-note">路线为代表性策展连接；箭头不表示每一件具体手机的唯一真实物流路径。数量未知显示为未知，不等于零。<span className="graph-scroll-hint">节点较多时可横向滚动查看。</span></div>
    </div>
    <GraphSelection node={selectedNode} flow={selectedFlow} productId={productId} context={context} onClear={() => { setSelectedNodeId(null); setSelectedFlowId(null); }} />
  </section>;
}

function GraphSelection({ node, flow, productId, context, onClear }: { node: ResolvedStoryNodeView | null; flow: ResolvedSupplyFlowView | null; productId: string; context: PageContext; onClear: () => void }) {
  if (!node && !flow) return <div className="graph-selection-empty">选择一个节点或连接，查看其商品、阶段、证据等级和来源。</div>;
  const title = node ? node.node.label : `${flow?.from.entity?.name ?? flow?.from.node?.node.label ?? "起点"} → ${flow?.to.entity?.name ?? flow?.to.node?.node.label ?? "终点"}`;
  const evidence = node ? node.evidence : flow?.evidence ?? [];
  return <aside className="graph-selection" aria-live="polite">
    <div className="graph-selection-heading"><div><p className="eyebrow">Selection detail</p><h3>{title}</h3></div><button className="graph-clear-button" onClick={onClear}>清除</button></div>
    <div className="graph-selection-meta"><span>{node?.entity?.name ?? flow?.from.entity?.name ?? "未指定地区"}</span><span>{node?.item?.name ?? flow?.item?.name ?? "未知货物"}</span><span>{node?.processStage?.label ?? flow?.processStage?.label ?? "未知阶段"}</span></div>
    <div className="graph-selection-status"><span className={`evidence-level-badge evidence-level-${(node?.evidenceLevel.code ?? flow?.evidenceLevel.code)}`}>{node?.evidenceLevel.label ?? flow?.evidenceLevel.label}</span><StatusBadge status={node?.node.dataStatus ?? flow?.flow.dataStatus ?? "unknown"} method={node?.node.method ?? flow?.flow.method} /></div>
    <p>{node?.node.notes ?? flow?.flow.notes ?? (node ? "该节点代表一个国家、市场或生产环节。" : "该连接表示两个节点之间的代表性流转关系。")}</p>
    <details className="graph-selection-evidence"><summary>查看证据与来源（{evidence.length}）</summary>{evidence.length === 0 ? <span className="muted">尚无直接证据记录。</span> : evidence.map(({ evidence: record, source }) => <div key={record.id}><span>{record.supportType}</span><small>{source?.name ?? record.sourceId} · {record.locator}</small></div>)}</details>
    {node && <Link className="text-link" href={nodePath(productId, node.node.id, context)}>打开完整节点详情 →</Link>}
  </aside>;
}
