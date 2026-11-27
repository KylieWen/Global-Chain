"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PageContext } from "../lib/context";
import { modelHasLedger, type ExplodedModel, type ExplodedNode } from "../lib/exploded-model";
import { explodedLinks, ledgerFallbackHref } from "../lib/exploded-links";
import { useThemePreference } from "./theme-preference";
import { StatusBadge } from "./data-display";
import { DroneStage, type DroneStageHandle } from "./drone-stage";
import { ExplodedExplorer } from "./exploded-explorer";
import "./drone-workstation.css";

const RENDERER_STORAGE_KEY = "globe-chain:exploded-renderer";
const ANIMATION_MS = 1100;

function readStoredRenderer(): "webgl" | "canvas2d" | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(RENDERER_STORAGE_KEY);
    return value === "canvas2d" || value === "webgl" ? value : null;
  } catch {
    return null;
  }
}

type Props = {
  model: ExplodedModel;
  productId: string;
  context: PageContext;
  initialFocus?: string | null;
  evidenceGapCount: number;
};

export function DroneWorkstation({ model, productId, context, initialFocus, evidenceGapCount }: Props) {
  const { tokens, reducedMotion } = useThemePreference();
  const initialNode = initialFocus && model.nodes.some((node) => node.id === initialFocus) ? initialFocus : model.root.id;
  const [selectedId, setSelectedId] = useState<string | null>(initialNode);
  const [explosion, setExplosion] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [storedRenderer, setStoredRenderer] = useState<"webgl" | "canvas2d" | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const stageRef = useRef<DroneStageHandle | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    setStoredRenderer(readStoredRenderer());
  }, []);

  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model]);
  const selected = selectedId ? nodeById.get(selectedId) ?? model.root : model.root;
  const links = explodedLinks(productId, selected, context);
  const hasLedger = modelHasLedger(model);

  const moduleNodes = model.nodes.filter((node) => node.depth === 1);
  const partCount = model.nodes.filter((node) => node.depth === 2).length;
  const laneMeta = new Map(model.lanes.map((lane) => [lane.id, lane]));
  const selectedLane = laneMeta.get(selected.lane);

  // Reduced motion, a stored forced fallback or a WebGL degradation route the
  // workstation back to the kept generic 2D exploded explorer.
  const useStage = !reducedMotion && storedRenderer !== "canvas2d" && !fallbackReason;

  useEffect(() => {
    if (!useStage) return;
    if (!playing) return;
    const target = explosion < 1 ? 1 : 0;
    const start = performance.now();
    const from = explosion;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setExplosion(from + (target - from) * eased);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [playing, useStage, explosion]);

  useEffect(() => () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
  }, []);

  const handleReset = () => {
    setPlaying(false);
    setExplosion(0);
    stageRef.current?.resetView();
  };

  const handlePlay = () => {
    if (reducedMotion) {
      setExplosion((value) => (value < 1 ? 1 : 0));
      return;
    }
    setPlaying((value) => !value);
  };

  if (!useStage) {
    return <ExplodedExplorer model={model} productId={productId} context={context} initialFocus={initialFocus} />;
  }

  const renderTreeButton = (node: ExplodedNode, depth: number) => (
    <li key={node.id} className="drone-tree-item">
      <button
        type="button"
        className={`drone-tree-button${selected.id === node.id ? " selected" : ""}`}
        style={{ paddingLeft: `${0.5 + depth * 0.7}rem` }}
        aria-pressed={selected.id === node.id}
        onClick={() => setSelectedId(node.id)}
      >
        <span className="drone-tree-swatch" data-lane={node.lane} />
        <span className="drone-tree-name">{node.name}</span>
      </button>
      {node.children.length > 0 && (
        <ul className="drone-tree-children">
          {node.children.map((child) => renderTreeButton(child, depth + 1))}
        </ul>
      )}
    </li>
  );

  return (
    <section className="drone-workstation" aria-labelledby="drone-workstation-title" data-fallback={fallbackReason ?? ""}>
      <header className="drone-topbar">
        <div className="drone-topbar-title">
          <p className="eyebrow" id="drone-workstation-title">拆解工作台</p>
        </div>
        <dl className="drone-metrics">
          <div className="drone-metric">
            <dt>部件节点</dt>
            <dd>{model.nodeCount}</dd>
          </div>
          <div className="drone-metric">
            <dt>一级模块</dt>
            <dd>{moduleNodes.length}</dd>
          </div>
          <div className="drone-metric">
            <dt>二级部件</dt>
            <dd>{partCount}</dd>
          </div>
          <div className="drone-metric">
            <dt>证据缺口</dt>
            <dd>{evidenceGapCount}</dd>
          </div>
          {context.period && (
            <div className="drone-metric">
              <dt>期间</dt>
              <dd>{context.period}</dd>
            </div>
          )}
        </dl>
      </header>

      <nav className="drone-tree" aria-label="部件模块树">
        <ul className="drone-tree-root">
          {renderTreeButton(model.root, 0)}
        </ul>
      </nav>

      <div className="drone-stage-column">
        <div className="drone-stage">
          <DroneStage
            ref={stageRef}
            model={model}
            productId={productId}
            scheme={tokens.scheme}
            tokens={tokens.palette}
            selectedId={selected.id}
            onSelect={setSelectedId}
            explosion={explosion}
            reducedMotion={reducedMotion}
            onFallback={setFallbackReason}
          />
        </div>
        <div className="drone-controls">
          <div className="drone-controls-main">
            <button
              type="button"
              className="button button-primary drone-play"
              onClick={handlePlay}
              aria-pressed={playing}
            >
              {playing ? "暂停" : explosion > 0 ? "复原部件" : "展开部件"}
            </button>
            <button type="button" className="button button-secondary drone-reset" onClick={handleReset}>
              复位视图
            </button>
            <label className="drone-slider">
              <span>展开程度</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={explosion}
                onChange={(event) => {
                  setPlaying(false);
                  setExplosion(Number(event.target.value));
                }}
                aria-label="调节部件展开程度"
              />
            </label>
            <span className="exploded-hint">拖动旋转 · 点击部件</span>
          </div>
          <div className="exploded-lanes" aria-label="拆解层级">
            {model.lanes.map((lane) => (
              <span key={lane.id} className={`exploded-lane${lane.present ? "" : " missing"}`} title={lane.missingNote ?? lane.hint}>
                <i className="exploded-lane-dot" />
                {lane.label}
                <small>{lane.present ? lane.nodeIds.length : "未收录"}</small>
              </span>
            ))}
          </div>
        </div>
      </div>

      <aside className="drone-detail" aria-live="polite">
        <header className="exploded-detail-header">
          <span className="card-kicker">{selected.category}{selectedLane ? ` · ${selectedLane.label}` : ""}</span>
          <h3>{selected.name}</h3>
          {selected.description ? <p>{selected.description}</p> : null}
          <div className="exploded-detail-badges">
            <StatusBadge status={selected.dataStatus} method={selected.method} />
          </div>
          <p className="exploded-detail-stats muted">第 {selected.depth + 1} 层{selected.routeNodeCount > 0 ? ` · ${selected.routeNodeCount} 个路线节点` : ""}{selected.routeFlowCount > 0 ? ` · ${selected.routeFlowCount} 条连接` : ""}</p>
          {selected.gapNote ? <p className="exploded-detail-gap">{selected.gapNote}</p> : null}
        </header>

        <div className="exploded-actions">
          {links.routeHref && <Link className="button button-primary" href={links.routeHref}>查看代表性路线 →</Link>}
          {links.processHref && <Link className="button button-secondary" href={links.processHref}>查看制造工序 →</Link>}
          {links.tradeMapHref && <Link className="button button-secondary" href={links.tradeMapHref}>查看贸易地图 →</Link>}
          {links.materialHref && <Link className="button button-secondary" href={links.materialHref}>材料贸易观察 →</Link>}
          {links.ledgerHrefs.map((ledger) => (
            <Link className="button button-secondary" key={ledger.id} href={ledger.href}>
              国家账本 · {ledger.name} →
            </Link>
          ))}
          {!hasLedger && (
            <Link className="button button-secondary" href={ledgerFallbackHref(productId, context)}>
              国家账本 · 待核验 →
            </Link>
          )}
          {!selected.explorable && <p className="muted exploded-no-route">该部件还没有已发布的路线或贸易记录。</p>}
        </div>
      </aside>
    </section>
  );
}
