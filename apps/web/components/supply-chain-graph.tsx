"use client";

import { itemLabel } from "../lib/item-label";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ResolvedSupplyFlowView, ResolvedStoryNodeView, SupplyChainStoryView } from "@globe-chain/domain";
import type { PageContext } from "../lib/context";
import { nodePath } from "../lib/paths";
import { StatusBadge } from "./data-display";

import { layoutSupplyGraph, routeSupplyEdge, roundedGraphPath } from "../lib/supply-graph-layout";

function shortLabel(value: string, length = 19) {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

export function SupplyChainGraph({ story, productId, context }: { story: SupplyChainStoryView; productId: string; context: PageContext }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<number | null>(null);
  const chooseStage = (stage: number | null) => { setStageFilter(stage); setSelectedNodeId(null); setSelectedFlowId(null); };
  const stageOrders = useMemo(() => [...new Set(story.nodes.map(({ processStage }) => processStage?.order ?? 0))].sort((a, b) => a - b), [story.nodes]);
  const stageInfo = useMemo(() => stageOrders.map((order) => ({ order, label: story.nodes.find(({ processStage }) => processStage?.order === order)?.processStage?.label ?? `阶段 ${order + 1}`, count: story.nodes.filter(({ processStage }) => (processStage?.order ?? 0) === order).length })), [stageOrders, story.nodes]);
  const visibleNodes = story.nodes.filter(({ processStage }) => stageFilter === null || (processStage?.order ?? 0) === stageFilter);
  const visibleIds = new Set(visibleNodes.map(({ node }) => node.id));
  const layout = layoutSupplyGraph(visibleNodes.map(view => ({ id: view.node.id, stage: view.processStage?.order ?? 0 })));
  const positions = layout.positions;
  // An entity-only endpoint cannot justify a link to an arbitrary factory/process node.
  const endpointNode = (endpoint: typeof story.flows[number]["from"]) => endpoint.node?.node.id;
  const visibleFlows = story.flows.filter((flow) => {
    const from = endpointNode(flow.from); const to = endpointNode(flow.to);
    return Boolean(from && to && visibleIds.has(from) && visibleIds.has(to));
  });
  const graphWidth = layout.width;
  const graphHeight = layout.height;
  const selectedNode = story.nodes.find(({ node }) => node.id === selectedNodeId) ?? null;
  const selectedFlow = story.flows.find(({ flow }) => flow.id === selectedFlowId) ?? null;
  const relatedNodes = new Set(selectedNodeId ? [selectedNodeId, ...visibleFlows.filter(flow => endpointNode(flow.from) === selectedNodeId || endpointNode(flow.to) === selectedNodeId).flatMap(flow => [endpointNode(flow.from), endpointNode(flow.to)])] : []);
  const isEvidenceOnly = story.interpretationSummary.mode === "evidence_only";

  return <section className="section-block visual-graph-section" aria-labelledby="visual-graph-title">
    <div className="section-heading"><div><p className="eyebrow">{isEvidenceOnly ? "生产环节" : "路线探索"}</p><h2 id="visual-graph-title">{isEvidenceOnly ? "生产环节" : "供应链路线图"}</h2></div><span className="section-caption">点击节点或连接，继续探索</span></div>
    <div className="graph-reading-key" aria-label="路线图例">
      <span><i className="graph-key-node" />国家或生产环节</span>
      <span><i className="graph-key-line graph-key-line-direct" />直接双边证据</span>
      <span><i className="graph-key-line graph-key-line-representative" />代表性整理连接</span>
    </div>
    <div className="graph-filter-bar" aria-label="阶段筛选">
      <div className="graph-filter-title"><strong>按阶段探索</strong><span>选择一个阶段聚焦查看节点</span></div>
      <div className="graph-filter-options">
        <button aria-pressed={stageFilter === null} className={stageFilter === null ? "filter-chip active" : "filter-chip"} onClick={() => chooseStage(null)}>全部阶段 <small>{story.nodes.length}</small></button>
        {stageInfo.map(({ order, label, count }) => <button aria-pressed={stageFilter === order} key={order} className={stageFilter === order ? "filter-chip active" : "filter-chip"} onClick={() => chooseStage(order)}>{label} <small>{count}</small></button>)}
      </div>
      <span className="filter-note">{stageFilter === null ? "完整路线" : `当前聚焦：${stageInfo.find((stage) => stage.order === stageFilter)?.label ?? "当前阶段"}`}</span>
    </div>
    <div className="route-graph-shell">
      <svg className="route-graph" viewBox={`0 0 ${graphWidth} ${graphHeight}`} style={{ width: graphWidth, minWidth: graphWidth }} role="img" aria-label="供应链代表性路线图">
        <defs><marker id="route-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9aa9bf" /></marker></defs>
        {layout.stages.map(stage => <g key={stage.order} className="graph-stage-band"><rect x={stage.x - 16} y={30} width={stage.width} height={graphHeight - 42} rx={12} /><text className="graph-stage-label" x={stage.x} y={18}>{stageInfo.find(info => info.order === stage.order)?.label}</text></g>)}
        {visibleFlows.map((flow, index) => {
          const from = endpointNode(flow.from); const to = endpointNode(flow.to);
          const a = from ? positions.get(from) : undefined; const b = to ? positions.get(to) : undefined;
          if (!a || !b) return null;
          const selected = selectedFlowId === flow.flow.id || Boolean(selectedNodeId && (from === selectedNodeId || to === selectedNodeId));
          const d = roundedGraphPath(routeSupplyEdge(a, b, index));
          return <g key={flow.flow.id} className={`graph-edge-group${selected ? " selected" : ""}${(selectedNodeId || selectedFlowId) && !selected ? " muted" : ""}`} onClick={() => { setSelectedFlowId(flow.flow.id); setSelectedNodeId(null); }} role="button" tabIndex={0} aria-label={`查看连接 ${itemLabel(flow.item)}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedFlowId(flow.flow.id); setSelectedNodeId(null); } }}>
            <path className={`graph-edge graph-edge-${flow.evidenceLevel.code}`} fill="none" d={d} markerEnd="url(#route-arrow)" /><path className="graph-edge-hit-area" fill="none" d={d} />
          </g>;
        })}
        {visibleNodes.map((node) => {
          const position = positions.get(node.node.id); if (!position) return null;
          const selected = selectedNodeId === node.node.id;
          return <g key={node.node.id} className={`graph-node${selected ? " selected" : ""}${selectedNodeId && !relatedNodes.has(node.node.id) ? " muted" : ""}`} onClick={() => { setSelectedNodeId(node.node.id); setSelectedFlowId(null); }} role="button" tabIndex={0} aria-label={`查看 ${node.node.label}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedNodeId(node.node.id); setSelectedFlowId(null); } }}>
            <rect x={position.x} y={position.y} width="176" height="76" rx="12" /><text className="graph-node-country" x={position.x + 12} y={position.y + 20}>{shortLabel(node.entity?.name ?? "未指定地区", 15)}</text><text className="graph-node-label" x={position.x + 12} y={position.y + 42}>{shortLabel(node.item ? itemLabel(node.item) : node.node.label)}</text><text className="graph-node-status" x={position.x + 12} y={position.y + 62}>{shortLabel(node.processStage?.label ?? "生产环节")}</text>
          </g>;
        })}
      </svg>
      <div className="route-graph-note"><span>虚线 · 代表性连接</span><span className="graph-scroll-hint">横向滑动查看全部环节</span></div>
    </div>
    <GraphSelection node={selectedNode} flow={selectedFlow} productId={productId} context={context} onClear={() => { setSelectedNodeId(null); setSelectedFlowId(null); }} />
  </section>;
}

function GraphSelection({ node, flow, productId, context, onClear }: { node: ResolvedStoryNodeView | null; flow: ResolvedSupplyFlowView | null; productId: string; context: PageContext; onClear: () => void }) {
  if (!node && !flow) return <div className="graph-selection-empty">选择一个生产环节，查看投入、产出和相关资料。</div>;
  const title = node ? node.node.label : `${flow?.from.entity?.name ?? flow?.from.node?.node.label ?? "起点"} → ${flow?.to.entity?.name ?? flow?.to.node?.node.label ?? "终点"}`;
  const evidence = node ? node.evidence : flow?.evidence ?? [];
  return <aside className="graph-selection" aria-live="polite">
    <div className="graph-selection-heading"><div><p className="eyebrow">所选环节</p><h3>{title}</h3></div><button className="graph-clear-button" onClick={onClear}>清除</button></div>
    <div className="graph-selection-meta"><span>{node?.entity?.name ?? flow?.from.entity?.name ?? "未指定地区"}</span><span>{itemLabel(node?.item ?? flow?.item)}</span><span>{node?.processStage?.label ?? flow?.processStage?.label ?? "未知阶段"}</span></div>
    <div className="graph-selection-status"><span className={`evidence-level-badge evidence-level-${(node?.evidenceLevel.code ?? flow?.evidenceLevel.code)}`}>{node?.evidenceLevel.label ?? flow?.evidenceLevel.label}</span><StatusBadge status={node?.node.dataStatus ?? flow?.flow.dataStatus ?? "unknown"} method={node?.node.method ?? flow?.flow.method} /></div>
    <p>{node?.node.notes ?? flow?.flow.notes}</p>
    <details className="graph-selection-evidence"><summary>查看证据与来源（{evidence.length}）</summary>{evidence.length === 0 ? <span className="muted">尚无直接证据记录。</span> : evidence.map(({ evidence: record, source }) => <div key={record.id}><span>{{ country_role: "产地", bilateral_flow: "贸易", process_context: "工艺", trade_observation: "贸易记录", curation_method: "路线整理" }[record.supportType as string] ?? "资料"}</span><small>{source?.name ?? record.sourceId} · {record.locator}</small></div>)}</details>
    {node && <Link className="text-link" href={nodePath(productId, node.node.id, context)}>打开完整节点详情 →</Link>}
  </aside>;
}
