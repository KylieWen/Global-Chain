"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PageContext } from "../lib/context";
import type { ExplodedModel } from "../lib/exploded-model";
import { explodedLinks } from "../lib/exploded-links";
import { useThemePreference } from "./theme-preference";
import { StatusBadge } from "./data-display";
import { ExplodedCanvasViewer, type ExplodedViewerHandle } from "./exploded-canvas-viewer";
import { ExplodedThreeViewer } from "./exploded-three-viewer";
import { ExplodedIsoView } from "./exploded-iso-view";
import { resolveNodeRole, schemeMaterials, viewerConfig } from "../lib/exploded-appearance";
import "./exploded-view.css";

const RENDERER_STORAGE_KEY = "globe-chain:exploded-renderer";
const DEFAULT_EXPLOSION = viewerConfig().defaultExplosion;

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
};

const MATERIAL_TYPES = new Set(["material", "raw_material"]);

export function ExplodedExplorer({ model, productId, context, initialFocus }: Props) {
  const { tokens, reducedMotion } = useThemePreference();
  const initialNode = initialFocus && model.nodes.some((node) => node.id === initialFocus) ? initialFocus : model.root.id;
  const [selectedId, setSelectedId] = useState<string | null>(initialNode);
  const [explosion, setExplosion] = useState(() => viewerConfig(productId).defaultExplosion || DEFAULT_EXPLOSION);
  const viewerRef = useRef<ExplodedViewerHandle | null>(null);
  // Keep the first render identical on server and client; the stored renderer is
  // read in an effect after mount so a forced fallback cannot cause a hydration mismatch.
  const [storedRenderer, setStoredRenderer] = useState<"webgl" | "canvas2d" | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  useLayoutEffect(() => {
    setStoredRenderer(readStoredRenderer());
  }, []);

  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model]);
  const selected = selectedId ? nodeById.get(selectedId) ?? model.root : model.root;
  const links = explodedLinks(productId, selected, context);
  const mounted = useRef(false);
  const isProcedural = model.renderMode === "procedural-3d";

  // Reduced motion, a stored forced fallback, or a WebGL degradation all route
  // the procedural view to the kept 2D canvas implementation.
  const useWebGL = isProcedural && !reducedMotion && storedRenderer !== "canvas2d" && !fallbackReason;

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    document.querySelector(".exploded-detail-header")?.scrollIntoView({
      block: "nearest",
      behavior: reducedMotion ? "auto" : "smooth"
    });
  }, [selectedId, reducedMotion]);

  const descendantMaterials = useMemo(() => {
    const ids = new Set(selected.descendantIds);
    return model.nodes.filter((node) => ids.has(node.id) && MATERIAL_TYPES.has(node.itemType));
  }, [selected, model]);

  // All material samples, shown as a compact clickable strip in narrow mode
  // (the 3D material meshes are hidden there so the body cannot cover them).
  const stripMaterials = useMemo(
    () => model.nodes.filter((node) => node.lane === "material"),
    [model]
  );
  const schemePalette = useMemo(() => schemeMaterials(tokens.scheme), [tokens.scheme]);

  const laneMeta = new Map(model.lanes.map((lane) => [lane.id, lane]));
  const selectedLane = laneMeta.get(selected.lane);

  return (
    <section className="exploded-explorer" aria-labelledby="exploded-title" data-fallback={fallbackReason ?? ""}>
      <div className="exploded-stage">
        <div className="exploded-stage-heading">
          <div>
            <p className="eyebrow">程序化拆解</p>
            <h2 id="exploded-title">商品拆解图</h2>
          </div>
          <span className="exploded-mode-badge">
            {isProcedural ? "可旋转 3D 爆炸图" : "等距分层图"}
          </span>
        </div>

        {model.gaps.length > 0 && (
          <details className="exploded-scope">
            <summary>依据与适用范围</summary>
            <ul className="exploded-gaps" aria-label="拆解数据缺口">
              {model.gaps.map((gap) => <li key={gap}>{gap}</li>)}
            </ul>
          </details>
        )}

        {isProcedural ? (
          useWebGL ? (
            <ExplodedThreeViewer
              ref={viewerRef}
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
          ) : (
            <ExplodedCanvasViewer
              ref={viewerRef}
              model={model}
              productId={productId}
              scheme={tokens.scheme}
              tokens={tokens.palette}
              selectedId={selected.id}
              onSelect={setSelectedId}
              explosion={explosion}
              reducedMotion={reducedMotion}
            />
          )
        ) : (
          <ExplodedIsoView
            model={model}
            productId={productId}
            scheme={tokens.scheme}
            tokens={tokens.palette}
            selectedId={selected.id}
            onSelect={setSelectedId}
            explosion={explosion}
          />
        )}

        {isProcedural && useWebGL && stripMaterials.length > 0 && (
          <div className="exploded-material-strip">
            {stripMaterials.map((node) => {
              const role = resolveNodeRole(productId, node);
              const color = schemePalette[role.material] ?? schemePalette.material;
              return (
                <button
                  type="button"
                  key={node.id}
                  className={`exploded-material-strip-chip${selected.id === node.id ? " selected" : ""}`}
                  aria-pressed={selected.id === node.id}
                  onClick={() => setSelectedId(node.id)}
                >
                  <span className="exploded-material-swatch" style={{ backgroundColor: color }} />
                  {node.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="exploded-controls">
          <div className="exploded-controls-main">
            {isProcedural && (
              <button
                type="button"
                className="button button-secondary exploded-reset"
                onClick={() => viewerRef.current?.resetView()}
              >
                重置视角
              </button>
            )}
            <label className="exploded-slider">
              <span>爆炸程度</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={explosion}
                onChange={(event) => setExplosion(Number(event.target.value))}
                aria-label="调节部件展开程度"
              />
            </label>
            <span className="exploded-hint">{isProcedural ? "拖动旋转 · 滚轮缩放 · 点击部件" : "点击部件查看详情"}</span>
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

      <aside className="exploded-detail" aria-live="polite">
        <header className="exploded-detail-header">
          <span className="card-kicker">{selected.category}{selectedLane ? ` · ${selectedLane.label}` : ""}</span>
          <h3>{selected.name}</h3>
          {selected.description ? <p>{selected.description}</p> : null}
          <div className="exploded-detail-badges">
            <StatusBadge status={selected.dataStatus} method={selected.method} />
          </div>
          <p className="exploded-detail-stats muted">第 {selected.depth + 1} 层 · {selected.routeNodeCount} 个路线节点 · {selected.routeFlowCount} 条连接</p>
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
          {!selected.explorable && <p className="muted exploded-no-route">该部件尚无已发布的路线、工序或贸易记录。</p>}
        </div>

        {descendantMaterials.length > 0 && (
          <div className="exploded-desc-materials">
            <p className="eyebrow">下属材料</p>
            <div className="exploded-material-chips">
              {descendantMaterials.map((material) => {
                const materialLinks = explodedLinks(productId, material, context);
                return (
                  <Link
                    key={material.id}
                    className={`exploded-material-chip${selected.id === material.id ? " selected" : ""}`}
                    href={materialLinks.materialHref ?? materialLinks.tradeMapHref ?? "#"}
                    onClick={() => setSelectedId(material.id)}
                  >
                    {material.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      <nav className="exploded-node-list" aria-label="全部部件列表">
        {model.lanes.filter((lane) => lane.present).map((lane) => (
          <div className="exploded-node-list-group" key={lane.id}>
            <span className="exploded-node-list-label">{lane.label}</span>
            <div className="exploded-node-list-items">
              {lane.nodeIds.map((id) => {
                const node = nodeById.get(id);
                if (!node) return null;
                return (
                  <button
                    type="button"
                    key={id}
                    className={`exploded-node-list-item${selected.id === id ? " selected" : ""}`}
                    aria-pressed={selected.id === id}
                    onClick={() => setSelectedId(id)}
                  >
                    {node.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </section>
  );
}
